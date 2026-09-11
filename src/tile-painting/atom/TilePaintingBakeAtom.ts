import { Cause, Effect, Exit } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { bakeAllTilePaintingsFx } from "~/tile-painting/fx/bakeAllTilePaintingsFx";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";

export namespace TilePaintingBakeAtom {
	export interface BakeCommand {
		readonly total: number;
		readonly kind: "bake";
	}

	export type State =
		| {
				readonly kind: "idle";
		  }
		| {
				readonly kind: "baking";
				readonly progress: {
					readonly completed: number;
					readonly total: number;
				};
		  }
		| {
				readonly error: unknown;
				readonly kind: "failure";
		  }
		| {
				readonly kind: "success";
				readonly result: bakeAllTilePaintingsFx.Output;
		  };
}

/** Owns one project's batch bake admission, progress and settlement across routed surfaces. */
export const TilePaintingBakeAtom = RendererRuntime.runSync(
	Effect.map(ProjectRepository, (repository) =>
		Atom.family((projectId: string) => {
			const stateAtom = Atom.make<TilePaintingBakeAtom.State>({
				kind: "idle",
			}).pipe(Atom.keepAlive);
			const runnerAtom = Atom.fn(
				(_command: TilePaintingBakeAtom.BakeCommand, get) =>
					Effect.gen(function* () {
						const exit = yield* Effect.exit(
							bakeAllTilePaintingsFx({
								onProgressFn: (completed, total) => {
									get.set(stateAtom, {
										kind: "baking",
										progress: {
											completed,
											total,
										},
									});
								},
								projectId,
							}).pipe(Effect.provideService(ProjectRepository, repository)),
						);
						if (Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause))
							return yield* Effect.failCause(exit.cause);
						yield* Atom.set(
							stateAtom,
							Exit.isSuccess(exit)
								? {
										kind: "success",
										result: exit.value,
									}
								: {
										kind: "failure",
										error: Cause.squash(exit.cause),
									},
						);
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
				(context, command: TilePaintingBakeAtom.BakeCommand) => {
					const state = context.get(stateAtom);
					if (state.kind === "baking") return;
					context.set(stateAtom, {
						kind: "baking",
						progress: {
							completed: 0,
							total: command.total,
						},
					});
					context.set(runnerAtom, command);
				},
			).pipe(Atom.keepAlive);
		}),
	),
);
