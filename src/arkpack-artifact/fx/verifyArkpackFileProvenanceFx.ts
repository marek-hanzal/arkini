import { Effect } from "effect";

import { ArkpackDistributionChannel } from "~/arkpack-artifact/constant/ArkpackDistributionChannel";
import trustedRootJson from "~/arkpack-artifact/constant/trusted-root.json";
import type { ArkpackProvenanceSchema } from "~/arkpack-artifact/schema/ArkpackProvenanceSchema";
import type { ArkpackFileLayout } from "~/arkpack-artifact/type/ArkpackFileLayout";
import { verifyArkpackProofFx } from "./verifyArkpackProofFx";

export namespace verifyArkpackFileProvenanceWithFx {
	export interface Props {
		readonly layout: ArkpackFileLayout;
		readonly channel: {
			readonly issuer: string;
			readonly subjectAlternativeName: RegExp;
		};
		readonly trustedRoot: unknown;
	}
}

/** Applies one explicit offline trust policy to the streamed payload identity. */
export const verifyArkpackFileProvenanceWithFx = Effect.fn("verifyArkpackFileProvenanceWithFx")(
	({ layout, channel, trustedRoot }: verifyArkpackFileProvenanceWithFx.Props) => {
		if (layout.proof === undefined)
			return Effect.succeed({
				type: "community",
			} satisfies ArkpackProvenanceSchema.Type);
		return verifyArkpackProofFx({
			artifact: new TextEncoder().encode(layout.contentHash),
			proof: layout.proof,
			channel,
			trustedRoot,
		});
	},
);

/** Offline-classifies the proof bound to one file-backed Arkpack payload. */
export const verifyArkpackFileProvenanceFx = Effect.fn("verifyArkpackFileProvenanceFx")(
	(layout: ArkpackFileLayout) =>
		verifyArkpackFileProvenanceWithFx({
			layout,
			channel: ArkpackDistributionChannel,
			trustedRoot: trustedRootJson,
		}),
);
