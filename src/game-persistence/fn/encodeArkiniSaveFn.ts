import { encode } from "@msgpack/msgpack";
import { ArkiniAppVersion } from "../../../shared/ArkiniAppMetadata";
import type { ArkiniSaveSchema } from "~/game-persistence/schema/ArkiniSaveSchema";
import type { StateSchema } from "~/game-persistence/schema/StateSchema";
import type { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";

interface Props {
	readonly version: ArkpackVersionSchema.Type;
	readonly state: StateSchema.Type;
}

/** Encodes one complete canonical gameplay state with its compatibility provenance. */
export const encodeArkiniSaveFn = ({ version, state }: Props) =>
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
