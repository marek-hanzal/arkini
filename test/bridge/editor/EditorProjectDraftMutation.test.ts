import { scheduleTask } from "@effect/atom-react";
import { Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import type { EditorItem } from "~/bridge/item/editor/EditorItemModel";
import { editorTestConfig } from "~test/editor/support/editorTestPayload";

const saves = vi.hoisted(() => ({
	run: vi.fn(),
}));

vi.mock("~/bridge/item/editor/saveEditorItemFx", () => ({
	saveEditorItemFx: (variables: unknown) => saves.run(variables),
}));

import { closeEditorProjectSessionFx } from "~/bridge/editor/closeEditorProjectSessionFx";
import { EditorProjectAtom } from "~/bridge/editor/EditorProjectAtom";
import { EditorProjectDraftAtom } from "~/bridge/editor/EditorProjectDraftAtom";
import { persistEditorProjectMutationFx } from "~/bridge/editor/persistEditorProjectMutation";
import { releaseEditorProjectSessionFx } from "~/bridge/editor/releaseEditorProjectSessionFx";
import { stageEditorItemMutationFx } from "~/bridge/item/editor/stageEditorItemMutation";

const registries: AtomRegistry.AtomRegistry[] = [];
const createRegistry = () => {
	const registry = AtomRegistry.make({
		scheduleTask,
	});
	registries.push(registry);
	registry.mount(EditorProjectDraftAtom("project"));
	return registry;
};
const runInRegistry = <A, E>(
	registry: AtomRegistry.AtomRegistry,
	effect: Effect.Effect<A, E, AtomRegistry.AtomRegistry>,
) => Effect.runPromise(effect.pipe(Effect.provideService(AtomRegistry.AtomRegistry, registry)));

const createItem = (uid: string, id: string, title: string): EditorItem => ({
	...editorTestConfig.items.water,
	uid,
	id,
	title,
});

const createProject = (revision: string): EditorProject => ({
	projectId: "project",
	title: "Project",
	createdAtMs: 1,
	updatedAtMs: 1,
	revision,
	fileIndex: {},
	itemSourcePaths: {},
	config: editorTestConfig,
	resources: [],
	resourceSourcePaths: {},
	diagnostics: [],
});

beforeEach(() => {
	saves.run.mockReset();
});

afterEach(() => {
	for (const registry of registries.splice(0)) registry.dispose();
	Effect.runSync(releaseEditorProjectSessionFx("project"));
});

describe("editor project draft mutations", () => {
	it("stages one validated item without invoking the persistent item writer", async () => {
		const registry = createRegistry();
		const item = createItem("uid-staged", "item:staged", "Staged");

		await expect(
			runInRegistry(
				registry,
				stageEditorItemMutationFx({
					item,
					projectId: "project",
				}),
			),
		).resolves.toEqual(item);

		expect(registry.get(EditorProjectDraftAtom("project"))).toEqual({
			[item.uid]: item,
		});
		expect(saves.run).not.toHaveBeenCalled();
		await expect(
			runInRegistry(registry, closeEditorProjectSessionFx("project")),
		).rejects.toThrow("Save or discard the current editor changes");
	});

	it("rejects a second staged item that claims the same editable item ID", async () => {
		const registry = createRegistry();
		const first = createItem("uid-first", "item:shared", "First");
		const conflicting = createItem("uid-conflicting", "item:shared", "Conflicting");
		await runInRegistry(
			registry,
			stageEditorItemMutationFx({
				item: first,
				projectId: "project",
			}),
		);

		await expect(
			runInRegistry(
				registry,
				stageEditorItemMutationFx({
					item: conflicting,
					projectId: "project",
				}),
			),
		).rejects.toThrow("Item ID item:shared is already used by another item");
		expect(registry.get(EditorProjectDraftAtom("project"))).toEqual({
			[first.uid]: first,
		});
		expect(saves.run).not.toHaveBeenCalled();
	});

	it("clears a persisted prefix and retains the failed staged tail", async () => {
		const revisionA = "a".repeat(64);
		const revisionB = "b".repeat(64);
		const registry = createRegistry();
		const first = createItem("uid-first", "item:first", "First");
		const second = createItem("uid-second", "item:second", "Second");
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

		expect(
			saves.run.mock.calls.map(([variables]) => ({
				expectedRevision: (
					variables as {
						readonly expectedRevision: string;
					}
				).expectedRevision,
				uid: (
					variables as {
						readonly item: EditorItem;
					}
				).item.uid,
			})),
		).toEqual([
			{
				expectedRevision: revisionA,
				uid: first.uid,
			},
			{
				expectedRevision: revisionB,
				uid: second.uid,
			},
		]);
		expect(registry.get(EditorProjectDraftAtom("project"))).toEqual({
			[second.uid]: second,
		});
		expect(registry.get(EditorProjectAtom("project"))?.revision).toBe(revisionB);
		await expect(
			runInRegistry(registry, closeEditorProjectSessionFx("project")),
		).rejects.toThrow("Save or discard the current editor changes");
	});
});
