import { Effect } from "effect";

import type { EditorProjectCompatibilityResult } from "~/editor/version/EditorProjectCompatibility";
import { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";

/** Applies one classified editor commit to its persisted gameplay compatibility version. */
export const bumpArkpackVersionFx = Effect.fn("bumpArkpackVersionFx")(function* (
	version: ArkpackVersionSchema.Type,
	result: EditorProjectCompatibilityResult,
) {
	const components = ArkpackVersionSchema.parse(version).split(".").map(Number);
	const major = components[0];
	const minor = components[1];
	if (major === undefined || minor === undefined)
		return yield* Effect.die(
			new Error(`Arkpack version ${version} did not contain major and minor components.`),
		);
	return ArkpackVersionSchema.parse(
		result === "major"
			? `${major + 1}.0`
			: result === "minor"
				? `${major}.${minor + 1}`
				: version,
	);
});
