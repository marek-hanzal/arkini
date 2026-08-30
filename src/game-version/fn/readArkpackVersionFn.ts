import type { ArkpackVersionSchema } from "~/game-version/schema/ArkpackVersionSchema";

/** Reads the sole gameplay admission axis from a validated Arkpack version. */
export const readArkpackVersionFn = (version: ArkpackVersionSchema.Type) => ({
	major: version.slice(0, version.indexOf(".")),
});
