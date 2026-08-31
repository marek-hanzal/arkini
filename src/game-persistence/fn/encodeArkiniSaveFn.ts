import { encode } from "@msgpack/msgpack";
import { ArkiniAppVersion } from "../../../shared/ArkiniAppMetadata";
import type { ArkiniSaveSchema } from "~/game-persistence/schema/ArkiniSaveSchema";
import type { StateSchema } from "~/game-persistence/schema/StateSchema";
import type { VersionSchema as GameVersionSchema } from "~/game-version/schema/VersionSchema";

interface Props {
	readonly version: GameVersionSchema.Type;
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
