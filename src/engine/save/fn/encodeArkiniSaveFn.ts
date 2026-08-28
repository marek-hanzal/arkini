import { encode } from "@msgpack/msgpack";
import { ArkiniAppVersion } from "../../../../shared/ArkiniAppMetadata";
import type { ArkiniSaveSchema } from "~/engine/save/schema/ArkiniSaveSchema";
import type { StateSchema } from "~/engine/state/schema/StateSchema";
import type { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";

export namespace encodeArkiniSaveFn {
	export interface Props {
		readonly version: ArkpackVersionSchema.Type;
		readonly state: StateSchema.Type;
	}
}

/** Encodes one complete canonical gameplay state with its compatibility provenance. */
export const encodeArkiniSaveFn = ({ version, state }: encodeArkiniSaveFn.Props) =>
	encode(
		{
			version,
			arkini: ArkiniAppVersion,
			state,
		} satisfies ArkiniSaveSchema.Type,
		{
			ignoreUndefined: true,
		},
	);
