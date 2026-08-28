import { Data, Effect } from "effect";

import { ArkiniAppVersion } from "../../../shared/ArkiniAppMetadata";
import { ArkiniVersionSchema } from "~/engine/version/schema/ArkiniVersionSchema";

type ArkiniArtifact = "Arkpack" | "save" | "Editor project" | "Editor version";

export class ArkiniVersionIncompatibleError extends Data.TaggedError(
	"ArkiniVersionIncompatibleError",
)<{
	readonly artifact: ArkiniArtifact;
	readonly writerVersion: ArkiniVersionSchema.Type;
	readonly readerVersion: ArkiniVersionSchema.Type;
	readonly writerMajor: string;
	readonly readerMajor: string;
	readonly message: string;
}> {}

const readMajor = (version: ArkiniVersionSchema.Type) => version.slice(0, version.indexOf("."));

export namespace ArkiniVersionAdmission {
	export const incompatibility = (
		artifact: ArkiniArtifact,
		writerVersion: ArkiniVersionSchema.Type,
	) => {
		const readerVersion = ArkiniVersionSchema.parse(ArkiniAppVersion);
		const writerMajor = readMajor(writerVersion);
		const readerMajor = readMajor(readerVersion);
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
}

/** Admits structurally current persisted data solely by its Arkini writer major. */
export const admitArkiniVersionFx = Effect.fn("admitArkiniVersionFx")(function* (
	artifact: ArkiniArtifact,
	writerVersion: ArkiniVersionSchema.Type,
) {
	const incompatibility = ArkiniVersionAdmission.incompatibility(artifact, writerVersion);
	if (incompatibility !== undefined) return yield* Effect.fail(incompatibility);
});
