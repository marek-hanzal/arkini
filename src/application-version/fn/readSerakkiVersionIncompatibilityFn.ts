import { SerakkiAppVersion } from "~shared/SerakkiAppMetadata";
import { SerakkiVersionIncompatibleError } from "~/application-version/error/SerakkiVersionIncompatibleError";
import type { SerakkiVersionSchema } from "~/application-version/schema/SerakkiVersionSchema";

const readMajorFn = (version: SerakkiVersionSchema.Type) => version.slice(0, version.indexOf("."));

/** Reads incompatibility solely from the Serakki writer and reader majors. */
export const readSerakkiVersionIncompatibilityFn = (
	artifact: SerakkiVersionIncompatibleError["artifact"],
	writerVersion: SerakkiVersionSchema.Type,
) => {
	const readerVersion = SerakkiAppVersion;
	const writerMajor = readMajorFn(writerVersion);
	const readerMajor = readMajorFn(readerVersion);
	return writerMajor === readerMajor
		? undefined
		: new SerakkiVersionIncompatibleError({
				artifact,
				writerVersion,
				readerVersion,
				writerMajor,
				readerMajor,
				message: `${artifact} was written by Serakki ${writerVersion}; Serakki ${readerVersion} only reads writer major ${readerMajor}.`,
			});
};
