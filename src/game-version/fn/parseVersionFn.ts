import type { VersionPartsSchema } from "~/game-version/schema/VersionPartsSchema";
import type { VersionSchema } from "~/game-version/schema/VersionSchema";

/** Materializes canonical project version parts from admitted external provenance. */
export const parseVersionFn = (version: VersionSchema.Type): VersionPartsSchema.Type => {
	const separator = version.indexOf(".");
	const suffixSeparator = version.indexOf("-", separator + 1);
	return {
		major: Number(version.slice(0, separator)),
		minor: Number(
			version.slice(separator + 1, suffixSeparator < 0 ? undefined : suffixSeparator),
		),
		...(suffixSeparator < 0
			? {}
			: {
					suffix: version.slice(suffixSeparator + 1),
				}),
	};
};
