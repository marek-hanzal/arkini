import { bundleFromJSON } from "@sigstore/bundle";
import { TrustedRoot } from "@sigstore/protobuf-specs";
import { toSignedEntity, toTrustMaterial, Verifier } from "@sigstore/verify";
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
	return ({ bytes, signature }: verifyArkpackTrustFx.Props): ArkpackTrustSchema.Type => {
		if (signature === undefined)
			return {
				type: "external",
			};
		try {
			const serialized = typeof signature === "string" ? JSON.parse(signature) : signature;
			const entity = toSignedEntity(bundleFromJSON(serialized), Buffer.from(bytes));
			verifier.verify(entity, {
				subjectAlternativeName: identity.subjectAlternativeName,
				extensions: {
					issuer: identity.issuer,
				},
			});
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
