import type { VersionPartsSchema } from "~/game-version/schema/VersionPartsSchema";
import type { VersionSchema } from "~/game-version/schema/VersionSchema";

/** Projects canonical project version parts into external gameplay provenance. */
export const formatVersionFn = (version: VersionPartsSchema.Type): VersionSchema.Type =>
	`${version.major}.${version.minor}${version.suffix === undefined ? "" : `-${version.suffix}`}`;
