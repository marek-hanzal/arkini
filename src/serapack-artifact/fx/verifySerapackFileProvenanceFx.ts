import { Effect } from "effect";

import { SerapackDistributionChannel } from "~/serapack-artifact/constant/SerapackDistributionChannel";
import trustedRootJson from "~/serapack-artifact/constant/trusted-root.json";
import type { SerapackProvenanceSchema } from "~/serapack-artifact/schema/SerapackProvenanceSchema";
import type { SerapackFileLayout } from "~/serapack-artifact/type/SerapackFileLayout";
import { verifySerapackProofFx } from "./verifySerapackProofFx";

export namespace verifySerapackFileProvenanceWithFx {
	export interface Props {
		readonly layout: SerapackFileLayout;
		readonly channel: {
			readonly issuer: string;
			readonly subjectAlternativeName: RegExp;
		};
		readonly trustedRoot: unknown;
	}
}

/** Applies one explicit offline trust policy to the streamed payload identity. */
export const verifySerapackFileProvenanceWithFx = Effect.fn("verifySerapackFileProvenanceWithFx")(
	({ layout, channel, trustedRoot }: verifySerapackFileProvenanceWithFx.Props) => {
		if (layout.proof === undefined)
			return Effect.succeed({
				type: "community",
			} satisfies SerapackProvenanceSchema.Type);
		return verifySerapackProofFx({
			artifact: new TextEncoder().encode(layout.contentHash),
			proof: layout.proof,
			channel,
			trustedRoot,
		});
	},
);

/** Offline-classifies the proof bound to one file-backed Serapack payload. */
export const verifySerapackFileProvenanceFx = Effect.fn("verifySerapackFileProvenanceFx")(
	(layout: SerapackFileLayout) =>
		verifySerapackFileProvenanceWithFx({
			layout,
			channel: SerapackDistributionChannel,
			trustedRoot: trustedRootJson,
		}),
);
