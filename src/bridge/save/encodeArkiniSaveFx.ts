import { encode } from "@msgpack/msgpack";
import { Effect } from "effect";
import { ArkiniAppVersion } from "../../../shared/ArkiniAppMetadata";
import type { ArkiniSaveSchema } from "~/bridge/save/ArkiniSaveSchema";
import type { StateSchema } from "~/engine/state/schema/StateSchema";
import type { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";

export namespace encodeArkiniSaveFx {
	export interface Props {
		readonly version: ArkpackVersionSchema.Type;
		readonly state: StateSchema.Type;
	}
}

/** Encodes one complete canonical gameplay state with its compatibility provenance. */
export const encodeArkiniSaveFx = Effect.fn("encodeArkiniSaveFx")(
	({ version, state }: encodeArkiniSaveFx.Props) =>
		Effect.sync(() =>
			encode(
				{
					version,
					arkini: ArkiniAppVersion,
					state,
				} satisfies ArkiniSaveSchema.Type,
				{
					ignoreUndefined: true,
				},
			),
		),
);
