import { Deferred, Effect, Fiber, SubscriptionRef } from "effect";
import { it } from "@effect/vitest";
import { expect } from "vitest";
import { scheduleTask } from "@effect/atom-react";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";

import { createEditorBoardGameResourceFx } from "~/board-scenario/fx/createEditorBoardGameResourceFx";
import { restoreBoardScenarioFx } from "~/board-scenario/fx/restoreBoardScenarioFx";
import { EditorBoardGameResourceOwnerAtom } from "~/board-scenario/atom/EditorBoardGameResourceOwnerAtom";
import type { EditorBoardGameResource } from "~/board-scenario/service/EditorBoardGameResource";
import type { Project } from "~/project-authoring/type/Project";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import { encodeArkiniSaveFn } from "~/game-persistence/fn/encodeArkiniSaveFn";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import { UnusedEditorProjectRepository } from "~test/support/UnusedEditorProjectRepository";

it.effect("rejects a pending scenario read after same-revision Editor route reentry", () =>
	Effect.gen(function* () {
		const project: Project = {
			projectId: "board",
			title: "Board",
			revision: 1,
			version: "1.0",
			createdAtMs: 1,
			updatedAtMs: 1,
			config: editorTestPayload.config,
			resources: editorTestPayload.resources,
		};
		const reading = yield* Deferred.make<void>();
		const releaseRead = yield* Deferred.make<void>();
		let created = 0;
		let disposed = 0;
		const owner = yield* createEditorBoardGameResourceFx({
			createResourceFx: (owned) =>
				Effect.sync(() => {
					created += 1;
					return {
						game: {
							projectId: owned.projectId,
							projectRevision: owned.revision,
							disposeWithoutSaveFx: Effect.sync(() => {
								disposed += 1;
							}),
						},
						assertUsableFn: () => undefined,
						getCriticalFailureFn: () => null,
						markCriticalFailureFn: () => undefined,
						subscribeCriticalFailureFn: () => () => undefined,
					} as unknown as EditorBoardGameResource.Resource;
				}),
		});
		const registry = AtomRegistry.make({
			scheduleTask,
		});
		try {
			yield* owner.syncFx(project);
			registry.set(EditorBoardGameResourceOwnerAtom, owner);
			const restoring = yield* restoreBoardScenarioFx({
				project,
				name: "Saved",
			}).pipe(
				Effect.provideService(AtomRegistry.AtomRegistry, registry),
				Effect.provideService(ProjectRepository, {
					...UnusedEditorProjectRepository,
					awaitIdleFx: Effect.void,
					createProjectFx: () => Effect.die("Unexpected create."),
					listProjectsFx: Effect.die("Unexpected list."),
					readProjectFx: () => Effect.die("Unexpected project read."),
					replaceConfigFx: () => Effect.die("Unexpected config write."),
					replaceResourceFx: () => Effect.die("Unexpected resource write."),
					deleteItemFx: () => Effect.die("Unexpected item delete."),
					upsertItemFx: () => Effect.die("Unexpected item write."),
					upsertResourcesFx: () => Effect.die("Unexpected resources write."),
					readBoardScenarioFx: () =>
						Effect.gen(function* () {
							yield* Deferred.succeed(reading, undefined);
							yield* Deferred.await(releaseRead);
							return {
								projectId: project.projectId,
								name: "Saved",
								version: "1.0",
								projectRevision: 1,
								createdAtMs: 1,
								updatedAtMs: 1,
								bytes: encodeArkiniSaveFn({
									version: "1.0",
									state: {
										cheats: {
											enabled: true,
											everEnabled: true,
											instantGameplay: false,
										},
										currentSpace: 0,
										items: [],
										jobs: [],
										jobQueue: [],
									},
								}),
							};
						}),
				}),
				Effect.flip,
				Effect.forkChild,
			);
			yield* Deferred.await(reading);
			yield* owner.releaseCurrentFx;
			yield* owner.syncFx(project);
			const successor = yield* SubscriptionRef.get(owner.state);
			yield* Deferred.succeed(releaseRead, undefined);
			const rejected = yield* Fiber.join(restoring);
			expect(rejected).toBeInstanceOf(Error);
			expect((rejected as Error).message).toContain("is no longer active");
			expect(yield* SubscriptionRef.get(owner.state)).toBe(successor);
			expect(created).toBe(2);
			expect(disposed).toBe(1);
		} finally {
			yield* owner.releaseCurrentFx;
			registry.dispose();
		}
	}),
);
