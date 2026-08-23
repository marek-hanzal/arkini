import { Effect } from "effect";

import {
	EditorProjectCompatibility,
	type EditorProjectCompatibilityLevel,
} from "~/editor/version/EditorProjectCompatibility";
import type { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";

/** Applies one classified editor commit to its persisted gameplay compatibility version. */
export const bumpArkpackVersionFx = Effect.fn("bumpArkpackVersionFx")(function* (
	version: ArkpackVersionSchema.Type,
	level: EditorProjectCompatibilityLevel,
) {
	return EditorProjectCompatibility.bumpVersion(version, level);
});
