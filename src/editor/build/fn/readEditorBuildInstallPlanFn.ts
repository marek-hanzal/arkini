import type { ArkpackDescriptor } from "~/engine/pack/Arkpack";
import type { EditorProjectBuildSchema } from "~/editor/EditorProjectBuildSchema";
import { readArkpackVersionFn } from "~/engine/version/fn/readArkpackVersionFn";
import type { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";

export interface EditorBuildMajorUpdateConfirmation {
	readonly installedContentHash: string;
	readonly installedVersion: ArkpackVersionSchema.Type;
	readonly targetContentHash: string;
	readonly targetVersion: ArkpackVersionSchema.Type;
}

export interface EditorBuildInstallPlan {
	readonly action: "install" | "update";
	readonly confirmation?: EditorBuildMajorUpdateConfirmation;
	readonly expectedCurrent: Pick<
		ArkpackDescriptor,
		"packageId" | "contentHash" | "version"
	> | null;
}

/** Classifies one exact build against the effective canonical package catalog. */
export const readEditorBuildInstallPlanFn = ({
	arkpacks,
	artifact,
	targetVersion,
}: {
	readonly arkpacks: ReadonlyArray<ArkpackDescriptor>;
	readonly artifact: EditorProjectBuildSchema.Type;
	readonly targetVersion: ArkpackVersionSchema.Type;
}): EditorBuildInstallPlan => {
	const installed = arkpacks.find(({ packageId }) => packageId === artifact.projectId);
	if (installed === undefined) {
		return {
			action: "install",
			confirmation: undefined,
			expectedCurrent: null,
		} satisfies EditorBuildInstallPlan;
	}
	const installedVersion = readArkpackVersionFn(installed.version);
	const nextVersion = readArkpackVersionFn(targetVersion);
	return {
		action: "update",
		expectedCurrent: {
			packageId: installed.packageId,
			contentHash: installed.contentHash,
			version: installed.version,
		},
		...(installedVersion.major === nextVersion.major
			? {}
			: {
					confirmation: {
						installedContentHash: installed.contentHash,
						installedVersion: installed.version,
						targetContentHash: artifact.contentHash,
						targetVersion,
					},
				}),
	};
};
