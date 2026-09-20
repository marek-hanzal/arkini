import { Effect, SubscriptionRef } from "effect";

import type { SerapackCatalog } from "~/serapack-catalog/service/SerapackCatalog";
import type { EditorBuildMajorUpdateConfirmation } from "~/editor-build/fn/readEditorBuildInstallPlanFn";
import { readEditorBuildInstallPlanFn } from "~/editor-build/fn/readEditorBuildInstallPlanFn";
import type { EditorProjectBuildSchema } from "~/editor-build/schema/EditorProjectBuildSchema";

const matchesConfirmationFn = (
	actual: EditorBuildMajorUpdateConfirmation,
	candidate: EditorBuildMajorUpdateConfirmation | undefined,
) =>
	candidate !== undefined &&
	candidate.installedContentHash === actual.installedContentHash &&
	candidate.installedVersion === actual.installedVersion &&
	candidate.targetContentHash === actual.targetContentHash &&
	candidate.targetVersion === actual.targetVersion;

/** Admits, rereads, and installs one exact Editor Build against current catalog truth. */
export const installBuiltEditorSerapackFx = Effect.fn("installBuiltEditorSerapackFx")(function* ({
	artifact,
	catalog,
	confirmation,
}: {
	readonly artifact: EditorProjectBuildSchema.Type;
	readonly catalog: SerapackCatalog;
	readonly confirmation?: EditorBuildMajorUpdateConfirmation;
}) {
	const catalogState = yield* SubscriptionRef.get(catalog.state);
	if (catalogState.type !== "ready") {
		return yield* Effect.fail(new Error("Serapack catalog is not ready."));
	}
	const plan = readEditorBuildInstallPlanFn({
		serapacks: catalogState.serapacks,
		artifact,
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
		packageId: artifact.projectId,
		expectedRevision: artifact.revision,
		contentHash: artifact.contentHash,
		expectedCurrent: plan.expectedCurrent,
	});
});
