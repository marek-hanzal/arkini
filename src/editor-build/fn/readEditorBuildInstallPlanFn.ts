import type { SerapackDescriptor } from "~/serapack-catalog/type/SerapackDescriptor";
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
		SerapackDescriptor,
		"packageId" | "contentHash" | "version"
	> | null;
}

/** Classifies one exact build against the effective canonical package catalog. */
export const readEditorBuildInstallPlanFn = ({
	serapacks,
	artifact,
}: {
	readonly serapacks: ReadonlyArray<SerapackDescriptor>;
	readonly artifact: EditorProjectBuildSchema.Type;
}): EditorBuildInstallPlan => {
	const installed = serapacks.find(({ packageId }) => packageId === artifact.projectId);
	if (installed === undefined) {
		return {
			action: "install",
			confirmation: undefined,
			expectedCurrent: null,
		} satisfies EditorBuildInstallPlan;
	}
	const installedVersion = readGameVersionMajorFn(installed.version);
	const nextVersion = readGameVersionMajorFn(artifact.version);
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
						targetVersion: artifact.version,
					},
				}),
	};
};
