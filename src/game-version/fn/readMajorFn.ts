import type { VersionSchema } from "~/game-version/schema/VersionSchema";

/** Reads the sole gameplay admission axis from a validated game version. */
export const readMajorFn = (version: VersionSchema.Type) => ({
	major: version.slice(0, version.indexOf(".")),
});
