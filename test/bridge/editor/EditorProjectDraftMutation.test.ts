import { scheduleTask } from "@effect/atom-react";
import { Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EditorItem } from "~/bridge/editor/EditorItemModel";
import type { EditorProject } from "~/bridge/editor/EditorProject";

const saves = vi.hoisted(() => ({
	run: vi.fn(),
}));

vi.mock("~/bridge/editor/saveEditorItemFx", () => ({
	saveEditorItemFx: (variables: unknown) => saves.run(variables),
}));

import { EditorProjectAtom } from "~/bridge/editor/EditorProjectAtom";
import { EditorProjectDraftAtom } from "~/bridge/editor/EditorProjectDraftAtom";
import { persistEditorProjectMutationFx } from "~/bridge/editor/persistEditorProjectMutation";
import { RendererAtomRegistry } from "~/bridge/reactivity/RendererAtomRegistry";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import {
	closeEditorProjectSessionFx,
	openEditorProjectSession,
	releaseEditorProjectSession,
} from "~/bridge/editor/EditorProjectSession";
import { stageEditorItemMutationFx } from "~/bridge/editor/stageEditorItemMutation";

const registries: AtomRegistry.AtomRegistry[] = [];
const createRegistry = () => {
	const registry = AtomRegistry.make({
		scheduleTask,
	});
	registries.push(registry);
	return registry;
};
const runInRegistry = <A, E>(
	registry: AtomRegistry.AtomRegistry,
	effect: Effect.Effect<A, E, AtomRegistry.AtomRegistry>,
) => Effect.runPromise(effect.pipe(Effect.provideService(AtomRegistry.AtomRegistry, registry)));

const createItem = (id: string, title: string): EditorItem => ({
	id,
	type: "simple",
	title,
	description: "Test item.",
	asset: {
		default: [
			"test",
		],
	},
	tags: [],
	categoryId: "category:test",
	scope: "any",
	maxStackSize: 1,
});

const createProject = (revision: string): EditorProject => ({
	projectId: "project",
	title: "Project",
	createdAtMs: 1,
	updatedAtMs: 1,
	revision,
	resources: [],
	resourceSourcePaths: {},
	itemSourcePaths: {},
	diagnostics: [],
});

beforeEach(() => {
	saves.run.mockReset();
});

afterEach(() => {
	for (const registry of registries.splice(0)) registry.dispose();
	releaseEditorProjectSession("project");
});

describe("editor project draft mutations", () => {
	it("publishes renderer-runtime staging through the React renderer registry", async () => {
		const projectId = "renderer-registry-project";
		const item = createItem("item:test", "Staged");

		await RendererRuntime.runPromise(
			stageEditorItemMutationFx({
				item,
				projectId,
			}),
		);

		expect(RendererAtomRegistry.get(EditorProjectDraftAtom(projectId))).toEqual({
			[item.id]: {
				item,
				sourceItemId: undefined,
				sourcePath: undefined,
			},
		});
	});

	it("retains staged changes after the last editor surface unmounts", async () => {
		const registry = AtomRegistry.make({
			defaultIdleTTL: 1,
			scheduleTask,
		});
		registries.push(registry);
		const atom = EditorProjectDraftAtom("project");
		const item = createItem("item:test", "Staged");
		const change = {
			item,
		};
		openEditorProjectSession("project", registry);
		const unmount = registry.mount(atom);
		registry.set(atom, {
			action: "stage",
			change,
			key: item.id,
		});

		unmount();
		await new Promise((resolve) => setTimeout(resolve, 10));

		expect(registry.get(atom)).toEqual({
			[item.id]: change,
		});
	});

	it("validates and stages one form item without writing the project", async () => {
		const registry = createRegistry();
		const item = createItem("item:test", "Staged");

		await runInRegistry(
			registry,
			stageEditorItemMutationFx({
				item,
				projectId: "project",
			}),
		);

		expect(registry.get(EditorProjectDraftAtom("project"))).toEqual({
			"item:test": {
				item,
				sourceItemId: undefined,
				sourcePath: undefined,
			},
		});
		expect(saves.run).not.toHaveBeenCalled();
		await expect(
			runInRegistry(registry, closeEditorProjectSessionFx("project")),
		).rejects.toThrow("Save the current item");
	});

	it("flushes staged items in revision order and clears dirty ownership", async () => {
		const revisionA = "a".repeat(64);
		const revisionB = "b".repeat(64);
		const revisionC = "c".repeat(64);
		const registry = createRegistry();
		registry.set(EditorProjectAtom("project"), {
			action: "refresh",
			expectedRevision: undefined,
			project: createProject(revisionA),
		});
		for (const item of [
			createItem("item:first", "First"),
			createItem("item:second", "Second"),
		]) {
			await runInRegistry(
				registry,
				stageEditorItemMutationFx({
					item,
					projectId: "project",
				}),
			);
		}
		saves.run.mockImplementation(
			({
				expectedRevision,
				item,
			}: {
				readonly expectedRevision: string;
				readonly item: EditorItem;
			}) => {
				const revision = expectedRevision === revisionA ? revisionB : revisionC;
				return Effect.succeed({
					item,
					project: createProject(revision),
					revision,
				});
			},
		);

		await runInRegistry(registry, persistEditorProjectMutationFx("project"));

		expect(
			saves.run.mock.calls.map(([variables]) => ({
				expectedRevision: (
					variables as {
						readonly expectedRevision: string;
					}
				).expectedRevision,
				id: (
					variables as {
						readonly item: EditorItem;
					}
				).item.id,
			})),
		).toEqual([
			{
				expectedRevision: revisionA,
				id: "item:first",
			},
			{
				expectedRevision: revisionB,
				id: "item:second",
			},
		]);
		expect(registry.get(EditorProjectDraftAtom("project"))).toEqual({});
		await expect(
			runInRegistry(registry, closeEditorProjectSessionFx("project")),
		).resolves.toBeUndefined();
	});

	it("keeps a newer restage of the same item while its previous snapshot persists", async () => {
		const revisionA = "a".repeat(64);
		const revisionB = "b".repeat(64);
		const registry = createRegistry();
		const previous = createItem("item:test", "Previous");
		const newer = createItem("item:test", "Newer");
		registry.set(EditorProjectAtom("project"), {
			action: "refresh",
			expectedRevision: undefined,
			project: createProject(revisionA),
		});
		await runInRegistry(
			registry,
			stageEditorItemMutationFx({
				item: previous,
				projectId: "project",
			}),
		);
		let completeSave: () => void = () => undefined;
		const saveGate = new Promise<void>((resolve) => {
			completeSave = resolve;
		});
		saves.run.mockImplementation(({ item }: { readonly item: EditorItem }) =>
			Effect.promise(() =>
				saveGate.then(() => ({
					item,
					project: createProject(revisionB),
					revision: revisionB,
				})),
			),
		);

		const persistence = runInRegistry(registry, persistEditorProjectMutationFx("project"));
		await vi.waitFor(() => expect(saves.run).toHaveBeenCalledOnce());
		await runInRegistry(
			registry,
			stageEditorItemMutationFx({
				item: newer,
				projectId: "project",
			}),
		);
		completeSave();
		await persistence;

		expect(registry.get(EditorProjectDraftAtom("project"))).toEqual({
			"item:test": {
				item: newer,
				sourceItemId: undefined,
				sourcePath: undefined,
			},
		});
	});

	it("removes completed changes but retains the failed tail for retry", async () => {
		const revisionA = "a".repeat(64);
		const revisionB = "b".repeat(64);
		const registry = createRegistry();
		const first = createItem("item:first", "First");
		const second = createItem("item:second", "Second");
		registry.set(EditorProjectAtom("project"), {
			action: "refresh",
			expectedRevision: undefined,
			project: createProject(revisionA),
		});
		for (const item of [
			first,
			second,
		]) {
			await runInRegistry(
				registry,
				stageEditorItemMutationFx({
					item,
					projectId: "project",
				}),
			);
		}
		saves.run
			.mockImplementationOnce(({ item }: { readonly item: EditorItem }) =>
				Effect.succeed({
					item,
					project: createProject(revisionB),
					revision: revisionB,
				}),
			)
			.mockImplementationOnce(() => Effect.fail(new Error("Second save failed.")));

		await expect(
			runInRegistry(registry, persistEditorProjectMutationFx("project")),
		).rejects.toThrow("Second save failed.");

		expect(registry.get(EditorProjectDraftAtom("project"))).toEqual({
			"item:second": {
				item: second,
				sourceItemId: undefined,
				sourcePath: undefined,
			},
		});
		expect(registry.get(EditorProjectAtom("project"))?.revision).toBe(revisionB);
	});
});
