import { bundleFromJSON } from "@sigstore/bundle";
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
				new Verifier(toTrustMaterial(TrustedRoot.fromJSON(trustedRoot)), {
					ctlogThreshold: 1,
					tlogThreshold: 1,
				}).verify(toSignedEntity(bundle, Buffer.from(artifact)), {
					subjectAlternativeName: channel.subjectAlternativeName,
					extensions: {
						issuer: channel.issuer,
					},
				});
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
