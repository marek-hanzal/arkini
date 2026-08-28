import { bundleFromJSON } from "@sigstore/bundle";
import { crypto as sigstoreCrypto } from "@sigstore/core";
import { TrustedRoot } from "@sigstore/protobuf-specs";
import { toSignedEntity, toTrustMaterial, Verifier } from "@sigstore/verify";
import { KeyObject, verify as verifyNodeSignature } from "node:crypto";
import { Effect } from "effect";

import { ArkiniReleaseIdentity } from "~/engine/pack/ArkiniReleaseIdentity";
import type { ArkpackProvenanceSchema } from "~/engine/pack/schema/ArkpackProvenanceSchema";
import trustedRootJson from "~/engine/pack/trusted-root.json";
import { decodeArkpackEnvelopeFx } from "./decodeArkpackEnvelopeFx";

export namespace verifyArkpackProvenanceFx {
	export interface Props {
		readonly bytes: Uint8Array;
	}
}

export const createArkpackProvenanceVerifier = ({
	identity,
	trustedRoot,
}: {
	readonly identity: {
		readonly issuer: string;
		readonly subjectAlternativeName: RegExp;
	};
	readonly trustedRoot: unknown;
}) => {
	const verifier = new Verifier(toTrustMaterial(TrustedRoot.fromJSON(trustedRoot)), {
		ctlogThreshold: 1,
		tlogThreshold: 1,
	});
	const verifySigstore = (entity: ReturnType<typeof toSignedEntity>) => {
		const originalVerify = sigstoreCrypto.verify;
		// Electron 43 requires the ECDSA digest explicitly, while Sigstore's Rekor checks omit it.
		sigstoreCrypto.verify = (data, key, signature, algorithm) => {
			const keyType = key instanceof KeyObject ? key.asymmetricKeyType : undefined;
			const digest =
				algorithm ?? (keyType === "ed25519" || keyType === "ed448" ? null : "sha256");
			try {
				return verifyNodeSignature(digest, data, key, signature);
			} catch {
				return false;
			}
		};
		try {
			return verifier.verify(entity, {
				subjectAlternativeName: identity.subjectAlternativeName,
				extensions: {
					issuer: identity.issuer,
				},
			});
		} finally {
			sigstoreCrypto.verify = originalVerify;
		}
	};
	return (bytes: Uint8Array): ArkpackProvenanceSchema.Type => {
		try {
			const { payload, proof } = Effect.runSync(decodeArkpackEnvelopeFx(bytes));
			if (proof === undefined)
				return {
					type: "community",
				};
			const serialized = JSON.parse(
				new TextDecoder("utf-8", {
					fatal: true,
				}).decode(proof),
			);
			verifySigstore(toSignedEntity(bundleFromJSON(serialized), Buffer.from(payload)));
			return {
				type: "official",
			};
		} catch {
			return {
				type: "community",
			};
		}
	};
};

const verifyReleaseProvenance = createArkpackProvenanceVerifier({
	identity: ArkiniReleaseIdentity,
	trustedRoot: trustedRootJson,
});

/** Offline soft classification of the proof embedded in one self-contained Arkpack. */
export const verifyArkpackProvenanceFx = Effect.fn("verifyArkpackProvenanceFx")(
	({ bytes }: verifyArkpackProvenanceFx.Props) =>
		Effect.sync(() => verifyReleaseProvenance(bytes)),
);
