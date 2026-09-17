import { ProjectWriteAdmission } from "~/project-authoring/service/ProjectWriteAdmission";
import { Cause, Effect, Exit } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { optimizeEditorResourcesFx } from "~/resource-authoring/fx/optimizeEditorResourcesFx";

export namespace EditorResourceOptimizationAtom {
	export interface OptimizeCommand {
		readonly expectedRevision: number;
		readonly kind: "optimize";
		readonly resourceIds: ProjectRepository.OptimizeResourcesProps["resourceIds"];
		readonly type: ProjectRepository.OptimizeResourcesProps["type"];
	}

	export type Command =
		| {
				readonly kind: "dismiss";
		  }
		| OptimizeCommand;

	export type State =
		| {
				readonly kind: "idle";
		  }
		| {
				readonly kind: "optimizing";
				readonly progress: ProjectRepository.OptimizeResourcesProgress;
				readonly type: ProjectRepository.OptimizeResourcesProps["type"];
		  }
		| {
				readonly error: unknown;
				readonly kind: "failure";
				readonly type: ProjectRepository.OptimizeResourcesProps["type"];
		  }
		| {
				readonly kind: "success";
				readonly result: ProjectRepository.OptimizeResourcesResult;
				readonly type: ProjectRepository.OptimizeResourcesProps["type"];
		  };
}

/** Owns one project's resource optimization and progress across routed surfaces. */
export const EditorResourceOptimizationAtom = RendererRuntime.runSync(
	Effect.map(
		Effect.all([
			ProjectRepository,
			ProjectWriteAdmission,
		]),
		([repository, admission]) =>
			Atom.family((projectId: string) => {
				const stateAtom = Atom.make<EditorResourceOptimizationAtom.State>({
					kind: "idle",
				}).pipe(Atom.keepAlive);
				const runnerAtom = Atom.fn(
					(command: EditorResourceOptimizationAtom.OptimizeCommand, get) =>
						Effect.gen(function* () {
							const exit = yield* Effect.exit(
								optimizeEditorResourcesFx({
									expectedRevision: command.expectedRevision,
									onProgressFn: (progress) => {
										get.set(stateAtom, {
											kind: "optimizing",
											progress,
											type: command.type,
										});
									},
									projectId,
									resourceIds: command.resourceIds,
									type: command.type,
								}).pipe(
									Effect.provideService(ProjectRepository, repository),
									Effect.provideService(ProjectWriteAdmission, admission),
								),
							);
							if (Exit.isFailure(exit)) {
								if (Cause.hasInterruptsOnly(exit.cause))
									return yield* Effect.failCause(exit.cause);
								yield* Atom.set(stateAtom, {
									error: Cause.squash(exit.cause),
									kind: "failure",
									type: command.type,
								});
								return;
							}
							yield* Atom.set(stateAtom, {
								kind: "success",
								result: exit.value,
								type: command.type,
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
						const state = context.get(stateAtom);
						if (state.kind === "optimizing") return;
						if (command.kind === "dismiss") {
							context.set(stateAtom, {
								kind: "idle",
							});
							return;
						}
						context.set(stateAtom, {
							kind: "optimizing",
							progress: {
								completedResourceCount: 0,
								phase: "optimizing",
								totalResourceCount: command.resourceIds.length,
							},
							type: command.type,
						});
						context.set(runnerAtom, command);
					},
				).pipe(Atom.keepAlive);
			}),
	),
);
