import { Effect, SubscriptionRef } from "effect";

import { EditorBuildRepository } from "~/editor-build/service/EditorBuildRepository";
import { readEditorBuildInstallPlanFn } from "~/editor-build/fn/readEditorBuildInstallPlanFn";
import { installBuiltEditorSerapackFx } from "~/editor-build/fx/installBuiltEditorSerapackFx";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import type { SerapackCatalog } from "~/serapack-catalog/service/SerapackCatalog";
import { formatVersionFn } from "~/game-version/fn/formatVersionFn";

/** Rebuilds only when the installed package predates the saved project revision or version. */
export const prepareProjectGameFx = Effect.fn("prepareProjectGameFx")(
	(projectId: string, catalog: SerapackCatalog) =>
		Effect.gen(function* () {
			const projects = yield* ProjectRepository;
			const builds = yield* EditorBuildRepository;
			const project = yield* projects.readProjectFx(projectId);
			if (project === null)
				return yield* Effect.fail(
					new Error(`Editor project ${projectId} no longer exists.`),
				);
			yield* catalog.awaitIdleFx;
			const state = yield* SubscriptionRef.get(catalog.state);
			if (state.type !== "ready")
				return yield* Effect.fail(new Error("Serapack catalog is not ready."));
			const installed = state.serapacks.find((serapack) => serapack.packageId === projectId);
			if (
				installed?.projectRevision === project.revision &&
				installed.version === formatVersionFn(project.version)
			)
				return {
					type: "ready" as const,
					packageId: installed.packageId,
				};
			const artifact = yield* builds.buildProjectFx({
				projectId,
			});
			const plan = readEditorBuildInstallPlanFn({
				serapacks: state.serapacks,
				artifact,
			});
			if (plan.confirmation !== undefined)
				return {
					type: "confirmation" as const,
					artifact,
					confirmation: plan.confirmation,
				};
			const published = yield* installBuiltEditorSerapackFx({
				artifact,
				catalog,
			});
			return {
				type: "ready" as const,
				packageId: published.packageId,
			};
		}),
);
