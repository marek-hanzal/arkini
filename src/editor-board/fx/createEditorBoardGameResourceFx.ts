import { Cause, Effect, Exit, Semaphore, SubscriptionRef } from "effect";

import type { Project } from "~/project-authoring/type/Project";
import type { EditorBoardGame } from "~/editor-board/type/EditorBoardGame";
import { type EditorBoardGameResource } from "~/editor-board/service/EditorBoardGameResource";
import { createEditorBoardGameFx } from "~/editor-board/fx/createEditorBoardGameFx";
import type { GameEngineResource } from "~/playable-game/type/GameEngineResource";
import { createGameEngineResourceFx } from "~/playable-game/fx/createGameEngineResourceFx";

export namespace createEditorBoardGameResourceFx {
	export interface Dependencies {
		readonly createResourceFx?: (
			project: Project,
		) => Effect.Effect<EditorBoardGameResource.Resource, unknown, never>;
	}
}

const ownsRevisionFn = (resource: GameEngineResource<EditorBoardGame>, project: Project) =>
	resource.game.projectId === project.projectId &&
	resource.game.projectRevision === project.revision;

const ownsNewerRevisionFn = (state: EditorBoardGameResource.State, project: Project) => {
	if (state.type === "idle") return false;
	if (state.type === "ready") {
		return (
			state.resource.game.projectId === project.projectId &&
			state.resource.game.projectRevision > project.revision
		);
	}
	return state.projectId === project.projectId && state.projectRevision > project.revision;
};

/** Creates the sole serialized owner of ephemeral editor-game sessions. */
export const createEditorBoardGameResourceFx = Effect.fn("createEditorBoardGameResourceFx")(
	(dependencies: createEditorBoardGameResourceFx.Dependencies = {}) =>
		Effect.gen(function* () {
			const lifecycle = yield* Semaphore.make(1);
			const state = yield* SubscriptionRef.make<EditorBoardGameResource.State>({
				type: "idle",
			});
			let current: EditorBoardGameResource.Resource | undefined;
			let routedProjectId: string | undefined;
			const createResourceFx =
				dependencies.createResourceFx ??
				((project: Project) =>
					createEditorBoardGameFx({
						project,
					}).pipe(Effect.flatMap((game) => createGameEngineResourceFx(game))));
			const publishFailureFx = (project: Project, cause: Cause.Cause<unknown>) =>
				SubscriptionRef.set(state, {
					type: "failed",
					projectId: project.projectId,
					projectRevision: project.revision,
					error: Cause.squash(cause),
				});

			const syncOwnedProjectFx = (project: Project) =>
				Effect.gen(function* () {
					const snapshot = yield* SubscriptionRef.get(state);
					if (ownsNewerRevisionFn(snapshot, project)) return;
					if (
						current !== undefined &&
						ownsRevisionFn(current, project) &&
						snapshot.type === "ready"
					)
						return;
					yield* SubscriptionRef.set(state, {
						type: "loading",
						projectId: project.projectId,
						projectRevision: project.revision,
					});
					if (current !== undefined) {
						const release = yield* Effect.exit(current.game.disposeWithoutSaveFx);
						if (Exit.isFailure(release)) {
							yield* publishFailureFx(project, release.cause);
							return;
						}
						current = undefined;
					}
					const created = yield* Effect.exit(createResourceFx(project));
					if (Exit.isFailure(created)) {
						yield* publishFailureFx(project, created.cause);
						return;
					}
					current = created.value;
					yield* SubscriptionRef.set(state, {
						type: "ready",
						resource: created.value,
					});
				});
			const syncFx: EditorBoardGameResource["syncFx"] = Effect.fn(
				"EditorBoardGameResourceFx.syncFx",
			)((project) =>
				lifecycle.withPermits(1)(
					Effect.gen(function* () {
						routedProjectId = project.projectId;
						yield* syncOwnedProjectFx(project);
					}).pipe(Effect.uninterruptible),
				),
			);
			const publishFx: EditorBoardGameResource["publishFx"] = Effect.fn(
				"EditorBoardGameResourceFx.publishFx",
			)((project) =>
				lifecycle.withPermits(1)(
					Effect.gen(function* () {
						if (routedProjectId !== project.projectId) return;
						yield* syncOwnedProjectFx(project);
					}).pipe(Effect.uninterruptible),
				),
			);
			const advanceNoopFx: EditorBoardGameResource["advanceNoopFx"] = Effect.fn(
				"EditorBoardGameResourceFx.advanceNoopFx",
			)((project, expectedPreviousRevision) =>
				lifecycle.withPermits(1)(
					Effect.gen(function* () {
						if (routedProjectId !== project.projectId) return;
						const snapshot = yield* SubscriptionRef.get(state);
						if (ownsNewerRevisionFn(snapshot, project)) return;
						if (
							snapshot.type !== "ready" ||
							current === undefined ||
							snapshot.resource !== current ||
							current.game.projectId !== project.projectId ||
							current.game.projectRevision !== expectedPreviousRevision
						) {
							yield* syncOwnedProjectFx(project);
							return;
						}
						const advanced: EditorBoardGameResource.Resource = {
							...current,
							game: {
								...current.game,
								config: project.config,
								projectRevision: project.revision,
							},
						};
						current = advanced;
						yield* SubscriptionRef.set(state, {
							type: "ready",
							resource: advanced,
						});
					}).pipe(Effect.uninterruptible),
				),
			);
			const releaseCurrentFx: EditorBoardGameResource["releaseCurrentFx"] = lifecycle
				.withPermits(1)(
					Effect.gen(function* () {
						routedProjectId = undefined;
						if (current !== undefined) {
							const owned = current;
							const release = yield* Effect.exit(owned.game.disposeWithoutSaveFx);
							if (Exit.isFailure(release)) {
								yield* SubscriptionRef.set(state, {
									type: "failed",
									projectId: owned.game.projectId,
									projectRevision: owned.game.projectRevision,
									error: Cause.squash(release.cause),
								});
								return yield* Effect.failCause(release.cause);
							}
							current = undefined;
						}
						yield* SubscriptionRef.set(state, {
							type: "idle",
						});
					}).pipe(Effect.uninterruptible),
				)
				.pipe(Effect.withSpan("EditorBoardGameResourceFx.releaseCurrentFx"));

			return {
				state,
				syncFx,
				publishFx,
				advanceNoopFx,
				releaseCurrentFx,
				shutdownFx: releaseCurrentFx.pipe(Effect.ignore),
			} satisfies EditorBoardGameResource;
		}),
);
