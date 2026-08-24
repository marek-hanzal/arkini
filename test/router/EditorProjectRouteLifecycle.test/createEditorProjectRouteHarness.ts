import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import { Deferred, Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { routeTree } from "~/_route";
import type { EditorProject } from "~/bridge/editor/EditorProject";
import type { EditorProjectRepositoryService } from "~/bridge/editor/EditorProjectRepository";
import type { EditorBoardGame } from "~/bridge/editor/board/EditorBoardGame";
import {
	type EditorBoardGameResource,
	EditorBoardGameResourceOwnerAtom,
} from "~/bridge/editor/board/EditorBoardGameResource";
import { createEditorBoardGameFx } from "~/bridge/editor/board/createEditorBoardGameFx";
import { createEditorBoardGameResourceFx } from "~/bridge/editor/board/createEditorBoardGameResourceFx";
import type { GameEngineResource } from "~/bridge/game/GameEngineResource";
import { createGameEngineResourceFx } from "~/bridge/game/createGameEngineResourceFx";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";
import { createTestRendererRuntime } from "~test/support/createTestRendererRuntime";
import { UnusedEditorBoardScenarioRepository } from "~test/support/UnusedEditorBoardScenarioRepository";

const runtimes: Array<ReturnType<typeof createTestRendererRuntime>["rendererRuntime"]> = [];

export const setUpEditorProjectRouteTest = () => {
	Object.defineProperty(window, "arkini", {
		configurable: true,
		value: {
			editor: {
				status: () =>
					Promise.resolve({
						type: "ready" as const,
					}),
			},
			editorMcp: {
				activate: () =>
					Promise.resolve({
						type: "ready" as const,
						port: 32_310,
					}),
			},
		},
	});
};

export const tearDownEditorProjectRouteTest = async () => {
	for (const runtime of runtimes.splice(0)) await runtime.dispose();
	Reflect.deleteProperty(window, "arkini");
};

const createProject = (projectId: string, revision = 1): EditorProject => ({
	projectId,
	title: editorTestPayload.config.meta.title,
	version: editorTestPayload.version,
	createdAtMs: 1,
	updatedAtMs: revision,
	revision,
	config: editorTestPayload.config,
	resources: editorTestPayload.resources,
});

const createRepository = (
	projects: ReadonlyMap<string, EditorProject>,
): EditorProjectRepositoryService => ({
	...UnusedEditorBoardScenarioRepository,
	awaitIdleFx: Effect.void,
	createProjectFx: () => Effect.die("Unexpected createProjectFx call."),
	listProjectsFx: Effect.succeed([]),
	readProjectFx: (projectId) => Effect.succeed(projects.get(projectId) ?? null),
	replaceConfigFx: () => Effect.die("Unexpected replaceConfigFx call."),
	replaceResourceFx: () => Effect.die("Unexpected replaceResourceFx call."),
	upsertItemFx: () => Effect.die("Unexpected upsertItemFx call."),
	upsertResourcesFx: () => Effect.die("Unexpected upsertResourcesFx call."),
});

export const createEditorProjectRouteHarness = async () => {
	const projectA = createProject("project-a");
	const projectB = createProject("project-b");
	const projects = new Map([
		[
			projectA.projectId,
			projectA,
		],
		[
			projectB.projectId,
			projectB,
		],
	]);
	const releaseProjectA = Effect.runSync(Deferred.make<void>());
	const events: string[] = [];
	const syncRequests: string[] = [];
	const { rendererRuntime } = createTestRendererRuntime({
		createResourceFx: () => Effect.die("Unexpected package Game acquisition."),
		editorProjectRepository: createRepository(projects),
	});
	runtimes.push(rendererRuntime);
	const owner = await rendererRuntime.runPromise(
		createEditorBoardGameResourceFx({
			createResourceFx: (project) =>
				Effect.gen(function* () {
					events.push(`create-${project.projectId}-r${project.revision}`);
					const game = yield* createEditorBoardGameFx({
						project,
					});
					const resource = yield* createGameEngineResourceFx(game);
					const disposeWithoutSaveFx = Effect.gen(function* () {
						events.push(`release-start-${project.projectId}-r${project.revision}`);
						if (project.projectId === projectA.projectId) {
							yield* Deferred.await(releaseProjectA);
						}
						yield* game.disposeWithoutSaveFx;
						events.push(`release-end-${project.projectId}-r${project.revision}`);
					});
					return {
						...resource,
						game: {
							...resource.game,
							disposeFx: disposeWithoutSaveFx,
							disposeWithoutSaveFx,
						},
					} satisfies GameEngineResource<EditorBoardGame>;
				}),
		}),
	);
	const trackedOwner: EditorBoardGameResource = {
		...owner,
		syncFx: (project) =>
			Effect.sync(() => {
				syncRequests.push(`${project.projectId}-r${project.revision}`);
			}).pipe(Effect.andThen(owner.syncFx(project))),
	};
	rendererRuntime.runSync(Atom.set(EditorBoardGameResourceOwnerAtom, trackedOwner));
	const router = createRouter({
		routeTree,
		isServer: false,
		context: {
			rendererRuntime,
		},
		history: createMemoryHistory({
			initialEntries: [
				"/editor/project-a/board",
			],
		}),
	});

	return {
		events,
		owner: trackedOwner,
		projectA,
		releaseProjectA,
		rendererRuntime,
		router,
		syncRequests,
	};
};
