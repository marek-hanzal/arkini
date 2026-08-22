import { Cause, Effect, Exit, Semaphore, SubscriptionRef } from "effect";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import type { EditorBoardGame } from "~/bridge/editor/board/EditorBoardGame";
import { type EditorBoardGameResource } from "~/bridge/editor/board/EditorBoardGameResource";
import { createEditorBoardGameFx } from "~/bridge/editor/board/createEditorBoardGameFx";
import type { GameEngineResource } from "~/bridge/game/GameEngineResource";
import { createGameEngineResourceFx } from "~/bridge/game/createGameEngineResourceFx";

export namespace createEditorBoardGameResourceFx {
	export interface Dependencies {
		readonly createResourceFx?: (
			project: EditorProject,
		) => Effect.Effect<EditorBoardGameResource.Resource, unknown>;
	}
}

const ownsRevision = (resource: GameEngineResource<EditorBoardGame>, project: EditorProject) =>
	resource.game.projectId === project.projectId &&
	resource.game.projectRevision === project.revision;

/** Creates the sole serialized owner of ephemeral editor-game sessions. */
export const createEditorBoardGameResourceFx = Effect.fn("createEditorBoardGameResourceFx")(
	(dependencies: createEditorBoardGameResourceFx.Dependencies = {}) =>
		Effect.gen(function* () {
			const lifecycle = yield* Semaphore.make(1);
			const state = yield* SubscriptionRef.make<EditorBoardGameResource.State>({
				type: "idle",
			});
			let current: EditorBoardGameResource.Resource | undefined;
			const createResourceFx =
				dependencies.createResourceFx ??
				((project: EditorProject) =>
					createEditorBoardGameFx({
						project,
					}).pipe(Effect.flatMap((game) => createGameEngineResourceFx(game))));
			const publishFailureFx = (project: EditorProject, cause: Cause.Cause<unknown>) =>
				SubscriptionRef.set(state, {
					type: "failed",
					projectId: project.projectId,
					projectRevision: project.revision,
					error: Cause.squash(cause),
				});

			const syncFx: EditorBoardGameResource["syncFx"] = Effect.fn(
				"EditorBoardGameResourceFx.syncFx",
			)((project) =>
				lifecycle.withPermits(1)(
					Effect.gen(function* () {
						const snapshot = yield* SubscriptionRef.get(state);
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
					}).pipe(Effect.uninterruptible),
				),
			);
			const releaseOwnedFx = Effect.fn("EditorBoardGameResourceFx.releaseOwnedFx")(
				(projectId?: string) =>
					lifecycle.withPermits(1)(
						Effect.gen(function* () {
							if (
								current === undefined ||
								(projectId !== undefined && current.game.projectId !== projectId)
							)
								return;
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
							yield* SubscriptionRef.set(state, {
								type: "idle",
							});
						}).pipe(Effect.uninterruptible),
					),
			);
			const releaseFx: EditorBoardGameResource["releaseFx"] = (projectId) =>
				releaseOwnedFx(projectId);
			const releaseCurrentFx: EditorBoardGameResource["releaseCurrentFx"] = releaseOwnedFx();

			return {
				state,
				syncFx,
				releaseFx,
				releaseCurrentFx,
				shutdownFx: releaseCurrentFx.pipe(Effect.ignore),
			} satisfies EditorBoardGameResource;
		}),
);
