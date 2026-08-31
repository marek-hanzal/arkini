import type { ArkpackDescriptor } from "~/arkpack-catalog/type/ArkpackDescriptor";
import type { EditorProjectBuildSchema } from "~/editor-build/schema/EditorProjectBuildSchema";
import { readMajorFn as readGameVersionMajorFn } from "~/game-version/fn/readMajorFn";
import type { VersionSchema as GameVersionSchema } from "~/game-version/schema/VersionSchema";

export interface EditorBuildMajorUpdateConfirmation {
	readonly installedContentHash: string;
	readonly installedVersion: GameVersionSchema.Type;
	readonly targetContentHash: string;
	readonly targetVersion: GameVersionSchema.Type;
}

interface EditorBuildInstallPlan {
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
	readonly targetVersion: GameVersionSchema.Type;
}): EditorBuildInstallPlan => {
	const installed = arkpacks.find(({ packageId }) => packageId === artifact.projectId);
	if (installed === undefined) {
		return {
			action: "install",
			confirmation: undefined,
			expectedCurrent: null,
		} satisfies EditorBuildInstallPlan;
	}
	const installedVersion = readGameVersionMajorFn(installed.version);
	const nextVersion = readGameVersionMajorFn(targetVersion);
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
