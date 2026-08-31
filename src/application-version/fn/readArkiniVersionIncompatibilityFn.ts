import { ArkiniAppVersion } from "~shared/ArkiniAppMetadata";
import { ArkiniVersionIncompatibleError } from "~/application-version/error/ArkiniVersionIncompatibleError";
import type { ArkiniVersionSchema } from "~/application-version/schema/ArkiniVersionSchema";

const readMajorFn = (version: ArkiniVersionSchema.Type) => version.slice(0, version.indexOf("."));

/** Reads incompatibility solely from the Arkini writer and reader majors. */
export const readArkiniVersionIncompatibilityFn = (
	artifact: ArkiniVersionIncompatibleError["artifact"],
	writerVersion: ArkiniVersionSchema.Type,
) => {
	const readerVersion = ArkiniAppVersion;
	const writerMajor = readMajorFn(writerVersion);
	const readerMajor = readMajorFn(readerVersion);
	return writerMajor === readerMajor
		? undefined
		: new ArkiniVersionIncompatibleError({
				artifact,
				writerVersion,
				readerVersion,
				writerMajor,
				readerMajor,
				message: `${artifact} was written by Arkini ${writerVersion}; Arkini ${readerVersion} only reads writer major ${readerMajor}.`,
			});
};
