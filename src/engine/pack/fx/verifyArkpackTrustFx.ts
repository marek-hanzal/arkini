import { bundleFromJSON } from "@sigstore/bundle";
import { crypto as sigstoreCrypto } from "@sigstore/core";
import { TrustedRoot } from "@sigstore/protobuf-specs";
import { toSignedEntity, toTrustMaterial, Verifier } from "@sigstore/verify";
import { KeyObject, verify as verifyNodeSignature } from "node:crypto";
import { Effect } from "effect";

import { ArkiniReleaseIdentity } from "~/engine/pack/ArkiniReleaseIdentity";
import type { ArkpackTrustSchema } from "~/engine/pack/schema/ArkpackTrustSchema";
import trustedRootJson from "~/engine/pack/trusted-root.json";

export namespace verifyArkpackTrustFx {
	export interface Props {
		readonly bytes: Uint8Array;
		readonly signature?: unknown;
	}
}

export const createArkpackTrustVerifier = ({
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
	return ({ bytes, signature }: verifyArkpackTrustFx.Props): ArkpackTrustSchema.Type => {
		if (signature === undefined)
			return {
				type: "external",
			};
		try {
			const serialized = typeof signature === "string" ? JSON.parse(signature) : signature;
			const entity = toSignedEntity(bundleFromJSON(serialized), Buffer.from(bytes));
			verifySigstore(entity);
			return {
				type: "trusted",
			};
		} catch {
			return {
				type: "external",
			};
		}
	};
};

const verifyReleaseTrust = createArkpackTrustVerifier({
	identity: ArkiniReleaseIdentity,
	trustedRoot: trustedRootJson,
});

/** Offline soft classification of exact bytes and an optional Sigstore bundle. */
export const verifyArkpackTrustFx = Effect.fn("verifyArkpackTrustFx")(
	(props: verifyArkpackTrustFx.Props) => Effect.sync(() => verifyReleaseTrust(props)),
);
