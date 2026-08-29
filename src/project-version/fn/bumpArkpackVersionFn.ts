import type { EditorProjectCompatibilityResult } from "~/project-version/EditorProjectCompatibility";
import { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";

/** Applies one classified editor commit to its persisted gameplay compatibility version. */
export const bumpArkpackVersionFn = (
	version: ArkpackVersionSchema.Type,
	result: EditorProjectCompatibilityResult,
) => {
	const components = ArkpackVersionSchema.parse(version).split(".").map(Number);
	const major = components[0];
	const minor = components[1];
	if (major === undefined || minor === undefined)
		throw new Error(`Arkpack version ${version} did not contain major and minor components.`);
	return ArkpackVersionSchema.parse(
		result === "major"
			? `${major + 1}.0`
			: result === "minor"
				? `${major}.${minor + 1}`
				: version,
	);
};
