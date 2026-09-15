import { bundleFromJSON } from "@sigstore/bundle";
import { crypto as sigstoreCrypto } from "@sigstore/core";
import { TrustedRoot } from "@sigstore/protobuf-specs";
import { toSignedEntity, toTrustMaterial, Verifier } from "@sigstore/verify";
import { KeyObject, verify as verifyNodeSignature } from "node:crypto";
import { Effect, Semaphore } from "effect";

import { ArkpackDistributionChannel } from "~/arkpack-artifact/constant/ArkpackDistributionChannel";
import type { ArkpackProvenanceSchema } from "~/arkpack-artifact/schema/ArkpackProvenanceSchema";
import trustedRootJson from "~/arkpack-artifact/constant/trusted-root.json";
import { decodeArkpackEnvelopeFx } from "./decodeArkpackEnvelopeFx";

export namespace verifyArkpackProvenanceFx {
	export interface Props {
		readonly bytes: Uint8Array;
	}
}

export namespace verifyArkpackProvenanceWithFx {
	export interface Props extends verifyArkpackProvenanceFx.Props {
		readonly channel: {
			readonly issuer: string;
			readonly subjectAlternativeName: RegExp;
		};
		readonly trustedRoot: unknown;
	}
}

export namespace verifyArkpackProofWithFx {
	export interface Props {
		readonly artifact?: Uint8Array;
		readonly artifactSignatureVerified?: boolean;
		readonly proof?: Uint8Array;
		readonly channel: verifyArkpackProvenanceWithFx.Props["channel"];
		readonly trustedRoot: unknown;
	}
}

const sigstoreVerification = Semaphore.makeUnsafe(1);

/** Verifies one parsed proof after either in-memory or streaming artifact admission. */
export const verifyArkpackProofWithFx = Effect.fn("verifyArkpackProofWithFx")(function* ({
	artifact,
	artifactSignatureVerified,
	proof,
	channel,
	trustedRoot,
}: verifyArkpackProofWithFx.Props) {
	if (proof === undefined)
		return {
			type: "community",
		} satisfies ArkpackProvenanceSchema.Type;

	return yield* sigstoreVerification.withPermits(1)(
		Effect.sync((): ArkpackProvenanceSchema.Type => {
			try {
				const verifier = new Verifier(toTrustMaterial(TrustedRoot.fromJSON(trustedRoot)), {
					ctlogThreshold: 1,
					tlogThreshold: 1,
				});
				const serialized = JSON.parse(
					new TextDecoder("utf-8", {
						fatal: true,
					}).decode(proof),
				);
				const bundle = bundleFromJSON(serialized);
				if (artifact === undefined && bundle.content?.$case !== "messageSignature")
					throw new Error("Streaming Arkpack proof is not a message signature.");
				const artifactSignature =
					bundle.content?.$case === "messageSignature"
						? Buffer.from(bundle.content.messageSignature.signature)
						: undefined;
				const entity = toSignedEntity(bundle, Buffer.from(artifact ?? new Uint8Array()));
				const originalVerifyFn = sigstoreCrypto.verify;
				// Electron 43 requires the ECDSA digest explicitly, while Sigstore's Rekor checks omit it.
				sigstoreCrypto.verify = (data, key, signature, algorithm) => {
					if (
						artifactSignatureVerified !== undefined &&
						artifactSignature !== undefined &&
						Buffer.from(signature).equals(artifactSignature)
					)
						return artifactSignatureVerified;
					const keyType = key instanceof KeyObject ? key.asymmetricKeyType : undefined;
					const digest =
						algorithm ??
						(keyType === "ed25519" || keyType === "ed448" ? null : "sha256");
					try {
						return verifyNodeSignature(digest, data, key, signature);
					} catch {
						return false;
					}
				};
				try {
					verifier.verify(entity, {
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
});

/** Soft-classifies an Arkpack against one explicit offline Sigstore trust policy. */
export const verifyArkpackProvenanceWithFx = Effect.fn("verifyArkpackProvenanceWithFx")(function* ({
	bytes,
	channel,
	trustedRoot,
}: verifyArkpackProvenanceWithFx.Props) {
	const decoded = yield* Effect.option(decodeArkpackEnvelopeFx(bytes));
	if (decoded._tag === "None" || decoded.value.proof === undefined)
		return {
			type: "community",
		} satisfies ArkpackProvenanceSchema.Type;

	return yield* verifyArkpackProofWithFx({
		artifact: decoded.value.payload,
		proof: decoded.value.proof,
		channel,
		trustedRoot,
	});
});

/** Offline soft classification of the proof embedded in one self-contained Arkpack. */
export const verifyArkpackProvenanceFx = Effect.fn("verifyArkpackProvenanceFx")(
	({ bytes }: verifyArkpackProvenanceFx.Props) =>
		verifyArkpackProvenanceWithFx({
			bytes,
			channel: ArkpackDistributionChannel,
			trustedRoot: trustedRootJson,
		}),
);
