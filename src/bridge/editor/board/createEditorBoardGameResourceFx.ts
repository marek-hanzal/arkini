import { Cause, Effect, Exit, Semaphore, SubscriptionRef } from "effect";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import type { EditorBoardGame } from "~/bridge/editor/board/EditorBoardGame";
import { type EditorBoardGameResource } from "~/bridge/editor/board/EditorBoardGameResource";
import { createEditorBoardGameFx } from "~/bridge/editor/board/createEditorBoardGameFx";
import type { GameEngineResource } from "~/bridge/game/GameEngineResource";
import { createGameEngineResourceFx } from "~/bridge/game/createGameEngineResourceFx";
import type { StateSchema } from "~/engine/state/schema/StateSchema";

export namespace createEditorBoardGameResourceFx {
	export interface Dependencies {
		readonly createResourceFx?: (
			project: EditorProject,
			state?: StateSchema.Type,
		) => Effect.Effect<EditorBoardGameResource.Resource, unknown>;
	}
}

const ownsRevision = (resource: GameEngineResource<EditorBoardGame>, project: EditorProject) =>
	resource.game.projectId === project.projectId &&
	resource.game.projectRevision === project.revision;

const ownsNewerRevision = (state: EditorBoardGameResource.State, project: EditorProject) => {
	if (state.type === "idle") return false;
	if (state.type === "ready") {
		return (
			state.resource.game.projectId === project.projectId &&
			state.resource.game.projectRevision > project.revision
		);
	}
	return state.projectId === project.projectId && state.projectRevision > project.revision;
};

const ownsExactRevision = (state: EditorBoardGameResource.State, project: EditorProject) => {
	if (state.type === "idle") return false;
	if (state.type === "ready") return ownsRevision(state.resource, project);
	return state.projectId === project.projectId && state.projectRevision === project.revision;
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
				((project: EditorProject, state?: StateSchema.Type) =>
					createEditorBoardGameFx({
						project,
						...(state === undefined
							? {}
							: {
									state,
								}),
					}).pipe(Effect.flatMap((game) => createGameEngineResourceFx(game))));
			const publishFailureFx = (project: EditorProject, cause: Cause.Cause<unknown>) =>
				SubscriptionRef.set(state, {
					type: "failed",
					projectId: project.projectId,
					projectRevision: project.revision,
					error: Cause.squash(cause),
				});

			const syncOwnedProjectFx = (project: EditorProject) =>
				Effect.gen(function* () {
					const snapshot = yield* SubscriptionRef.get(state);
					if (ownsNewerRevision(snapshot, project)) return;
					if (
						current !== undefined &&
						ownsRevision(current, project) &&
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
			const replaceFx: EditorBoardGameResource["replaceFx"] = Effect.fn(
				"EditorBoardGameResourceFx.replaceFx",
			)((project, nextState) =>
				lifecycle.withPermits(1)(
					Effect.gen(function* () {
						const snapshot = yield* SubscriptionRef.get(state);
						if (
							routedProjectId !== project.projectId ||
							!ownsExactRevision(snapshot, project) ||
							(current !== undefined && !ownsRevision(current, project))
						) {
							return yield* Effect.fail(
								new Error(
									`Editor Board project ${project.projectId} revision ${project.revision} is no longer active.`,
								),
							);
						}
						yield* SubscriptionRef.set(state, {
							type: "loading",
							projectId: project.projectId,
							projectRevision: project.revision,
						});
						if (current !== undefined) {
							const release = yield* Effect.exit(current.game.disposeWithoutSaveFx);
							if (Exit.isFailure(release)) {
								yield* publishFailureFx(project, release.cause);
								return yield* Effect.failCause(release.cause);
							}
							current = undefined;
						}
						const created = yield* Effect.exit(createResourceFx(project, nextState));
						if (Exit.isFailure(created)) {
							yield* publishFailureFx(project, created.cause);
							return yield* Effect.failCause(created.cause);
						}
						current = created.value;
						yield* SubscriptionRef.set(state, {
							type: "ready",
							resource: created.value,
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
				replaceFx,
				releaseCurrentFx,
				shutdownFx: releaseCurrentFx.pipe(Effect.ignore),
			} satisfies EditorBoardGameResource;
		}),
);
