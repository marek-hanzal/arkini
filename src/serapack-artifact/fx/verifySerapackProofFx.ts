import { bundleFromJSON } from "@sigstore/bundle";
import { crypto as sigstoreCrypto } from "@sigstore/core";
import { KeyObject, verify as verifyNodeSignatureFn } from "node:crypto";
import { TrustedRoot } from "@sigstore/protobuf-specs";
import { toSignedEntity, toTrustMaterial, Verifier } from "@sigstore/verify";
import { Effect } from "effect";

import type { SerapackProvenanceSchema } from "~/serapack-artifact/schema/SerapackProvenanceSchema";

export namespace verifySerapackProofFx {
	export interface Props {
		readonly artifact: Uint8Array;
		readonly proof?: Uint8Array;
		readonly channel: {
			readonly issuer: string;
			readonly subjectAlternativeName: RegExp;
		};
		readonly trustedRoot: unknown;
	}
}

/** Soft-classifies one artifact proof against an explicit offline trust policy. */
export const verifySerapackProofFx = Effect.fn("verifySerapackProofFx")(
	({ artifact, proof, channel, trustedRoot }: verifySerapackProofFx.Props) =>
		Effect.sync((): SerapackProvenanceSchema.Type => {
			if (proof === undefined)
				return {
					type: "community",
				};
			try {
				const bundle = bundleFromJSON(
					JSON.parse(
						new TextDecoder("utf-8", {
							fatal: true,
						}).decode(proof),
					),
				);
				const verifier = new Verifier(toTrustMaterial(TrustedRoot.fromJSON(trustedRoot)), {
					ctlogThreshold: 1,
					tlogThreshold: 1,
				});
				const originalVerifyFn = sigstoreCrypto.verify;
				// Electron requires an explicit ECDSA digest for Sigstore's Rekor checks.
				// The override and verification are synchronous; restore before yielding or returning.
				sigstoreCrypto.verify = (data, key, signature, algorithm) => {
					const keyType = key instanceof KeyObject ? key.asymmetricKeyType : undefined;
					const digest =
						algorithm ??
						(keyType === "ed25519" || keyType === "ed448" ? null : "sha256");
					try {
						return verifyNodeSignatureFn(digest, data, key, signature);
					} catch {
						return false;
					}
				};
				try {
					verifier.verify(toSignedEntity(bundle, Buffer.from(artifact)), {
						subjectAlternativeName: channel.subjectAlternativeName,
						extensions: {
							issuer: channel.issuer,
						},
					});
				} finally {
					sigstoreCrypto.verify = originalVerifyFn;
				}
				return {
					type: "official",
				};
			} catch {
				return {
					type: "community",
				};
			}
		}),
);
