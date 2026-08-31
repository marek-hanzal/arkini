import { Effect, SubscriptionRef } from "effect";

import type { ArkpackCatalog } from "~/arkpack-catalog/service/ArkpackCatalog";
import type { EditorBuildMajorUpdateConfirmation } from "~/editor-build/fn/readEditorBuildInstallPlanFn";
import { readEditorBuildInstallPlanFn } from "~/editor-build/fn/readEditorBuildInstallPlanFn";
import { readArkpackArtifactNameFn } from "~/arkpack-artifact/fn/readArkpackArtifactNameFn";
import type { EditorBuildRepositoryService } from "~/editor-build/service/EditorBuildRepository";
import type { EditorProjectBuildSchema } from "~/editor-build/schema/EditorProjectBuildSchema";
import type { ArkpackVersionSchema } from "~/game-version/schema/ArkpackVersionSchema";

const matchesConfirmationFn = (
	actual: EditorBuildMajorUpdateConfirmation,
	candidate: EditorBuildMajorUpdateConfirmation | undefined,
) =>
	candidate !== undefined &&
	candidate.installedContentHash === actual.installedContentHash &&
	candidate.installedVersion === actual.installedVersion &&
	candidate.targetContentHash === actual.targetContentHash &&
	candidate.targetVersion === actual.targetVersion;

/** Admits, rereads, and installs one exact Editor build against current catalog truth. */
export const installBuiltEditorArkpackFx = Effect.fn("installBuiltEditorArkpackFx")(function* ({
	artifact,
	catalog,
	confirmation,
	repository,
	targetVersion,
}: {
	readonly artifact: EditorProjectBuildSchema.Type;
	readonly catalog: ArkpackCatalog;
	readonly confirmation?: EditorBuildMajorUpdateConfirmation;
	readonly repository: Pick<EditorBuildRepositoryService, "readProjectBuildFx">;
	readonly targetVersion: ArkpackVersionSchema.Type;
}) {
	const catalogState = yield* SubscriptionRef.get(catalog.state);
	if (catalogState.type !== "ready") {
		return yield* Effect.fail(new Error("Arkpack catalog is not ready."));
	}
	const plan = readEditorBuildInstallPlanFn({
		arkpacks: catalogState.arkpacks,
		artifact,
		targetVersion,
	});
	if (
		plan.confirmation !== undefined &&
		!matchesConfirmationFn(plan.confirmation, confirmation)
	) {
		return yield* Effect.fail(
			new Error("Updating across gameplay major versions requires confirmation."),
		);
	}
	return yield* catalog.installFx({
		contentFx: repository.readProjectBuildFx({
			projectId: artifact.projectId,
			expectedRevision: artifact.revision,
			contentHash: artifact.contentHash,
		}),
		expectedCurrent: plan.expectedCurrent,
		filename: readArkpackArtifactNameFn(artifact.projectId),
		packageId: artifact.projectId,
	});
});
