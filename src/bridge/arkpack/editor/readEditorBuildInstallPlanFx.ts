import { Effect } from "effect";

import type { ArkpackDescriptor } from "~/bridge/arkpack/Arkpack";
import type { ArkpackCatalog } from "~/bridge/arkpack/ArkpackCatalog";
import { readArkpackVersionFx } from "~/bridge/game/ArkpackVersionCompatibility";
import type { EditorProjectBuildSchema } from "~/editor/EditorProjectBuildSchema";
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
	readonly expectedCurrent: ArkpackCatalog.PackageSnapshot | null;
}

/** Classifies one exact build against the effective canonical package catalog. */
export const readEditorBuildInstallPlanFx = Effect.fn("readEditorBuildInstallPlanFx")(function* ({
	arkpacks,
	artifact,
	targetVersion,
}: {
	readonly arkpacks: ReadonlyArray<ArkpackDescriptor>;
	readonly artifact: EditorProjectBuildSchema.Type;
	readonly targetVersion: ArkpackVersionSchema.Type;
}) {
	const installed = arkpacks.find(({ packageId }) => packageId === artifact.projectId);
	if (installed === undefined) {
		return {
			action: "install",
			confirmation: undefined,
			expectedCurrent: null,
		} satisfies EditorBuildInstallPlan;
	}
	const installedVersion = yield* readArkpackVersionFx(installed.version);
	const nextVersion = yield* readArkpackVersionFx(targetVersion);
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
	} satisfies EditorBuildInstallPlan;
});
