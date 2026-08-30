import type { EditorProjectCompatibilityResult } from "~/project-version/type/EditorProjectCompatibility";
import type { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";

/** Applies one classified editor commit to its persisted gameplay compatibility version. */
export const bumpArkpackVersionFn = (
	version: ArkpackVersionSchema.Type,
	result: EditorProjectCompatibilityResult,
) => {
	const [major = 0, minor = 0] = version.split(".").map(Number);
	return result === "major"
		? `${major + 1}.0`
		: result === "minor"
			? `${major}.${minor + 1}`
			: version;
};
