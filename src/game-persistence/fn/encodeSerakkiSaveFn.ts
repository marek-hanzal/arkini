import { SerakkiAppVersion } from "~shared/SerakkiAppMetadata";
import type { SerakkiSaveSchema } from "~/game-persistence/schema/SerakkiSaveSchema";
import type { StateSchema } from "~/game-persistence/schema/StateSchema";
import type { VersionSchema as GameVersionSchema } from "~/game-version/schema/VersionSchema";

interface Props {
	readonly version: GameVersionSchema.Type;
	readonly state: StateSchema.Type;
}

/** Encodes one complete canonical gameplay state with its compatibility provenance. */
export const encodeSerakkiSaveFn = ({ version, state }: Props) =>
	new TextEncoder().encode(
		JSON.stringify({
			version,
			serakki: SerakkiAppVersion,
			state,
		} satisfies SerakkiSaveSchema.Type),
	);
