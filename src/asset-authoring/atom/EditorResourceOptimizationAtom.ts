import { Cause, Effect, Exit } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { optimizeEditorResourcesFx } from "~/asset-authoring/fx/optimizeEditorResourcesFx";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";

export namespace EditorResourceOptimizationAtom {
	export interface Command {
		readonly expectedRevision: number;
		readonly resourceIds: ProjectRepository.OptimizeResourcesProps["resourceIds"];
	}

	export type State =
		| {
				readonly kind: "idle";
		  }
		| {
				readonly kind: "optimizing";
				readonly progress: ProjectRepository.OptimizeResourcesProgress;
		  }
		| {
				readonly error: unknown;
				readonly kind: "failure";
		  }
		| {
				readonly kind: "success";
				readonly result: ProjectRepository.OptimizeResourcesResult;
		  };
}

/** Owns one project's resource optimization and progress across routed surfaces. */
export const EditorResourceOptimizationAtom = RendererRuntime.runSync(
	Effect.map(ProjectRepository, (repository) =>
		Atom.family((projectId: string) => {
			const stateAtom = Atom.make<EditorResourceOptimizationAtom.State>({
				kind: "idle",
			}).pipe(Atom.keepAlive);
			const runnerAtom = Atom.fn(
				(command: EditorResourceOptimizationAtom.Command, get) =>
					Effect.gen(function* () {
						const exit = yield* Effect.exit(
							optimizeEditorResourcesFx({
								expectedRevision: command.expectedRevision,
								onProgressFn: (progress) => {
									get.set(stateAtom, {
										kind: "optimizing",
										progress,
									});
								},
								projectId,
								resourceIds: command.resourceIds,
							}).pipe(Effect.provideService(ProjectRepository, repository)),
						);
						if (Exit.isFailure(exit)) {
							if (Cause.hasInterruptsOnly(exit.cause))
								return yield* Effect.failCause(exit.cause);
							yield* Atom.set(stateAtom, {
								error: Cause.squash(exit.cause),
								kind: "failure",
							});
							return;
						}
						yield* Atom.set(stateAtom, {
							kind: "success",
							result: exit.value,
						});
					}),
				{
					concurrent: false,
				},
			).pipe(Atom.keepAlive);

			return Atom.writable(
				(get) => {
					get(runnerAtom);
					return get(stateAtom);
				},
				(context, command: EditorResourceOptimizationAtom.Command) => {
					if (context.get(stateAtom).kind === "optimizing") return;
					context.set(stateAtom, {
						kind: "optimizing",
						progress: {
							completedResourceCount: 0,
							phase: "optimizing",
							totalResourceCount: command.resourceIds.length,
						},
					});
					context.set(runnerAtom, command);
				},
			).pipe(Atom.keepAlive);
		}),
	),
);
