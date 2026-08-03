import { scheduleTask } from "@effect/atom-react";
import { Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { EditorProjectAtom } from "~/bridge/editor/EditorProjectAtom";
import {
	EditorProjectRepository,
	type EditorProjectRepositoryService,
} from "~/bridge/editor/EditorProjectRepository";
import { appendEditorItemLineFx } from "~/bridge/item/editor/appendEditorItemLineFx";
import type { EditorLine } from "~/bridge/item/editor/EditorItemModel";
import { replaceEditorItemLineFx } from "~/bridge/item/editor/replaceEditorItemLineFx";
import { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { editorTestConfig, editorTestPayload } from "~test/editor/support/editorTestPayload";

const registries: AtomRegistry.AtomRegistry[] = [];

const line = {
	id: "line:academy:1",
	title: "Research",
	description: "Researches one topic.",
	default: true,
	show: true,
	enable: true,
	runtimeMs: 1_000,
	input: [
		{
			type: "simple",
		},
	],
	rules: [],
} as const;

const producer = ItemSchema.parse({
	...editorTestConfig.items.water,
	uid: "academy",
	id: "producer:academy",
	type: "producer",
	title: "Academy",
	maxQueueSize: 1,
	lines: [
		line,
	],
});

if (producer.type !== "producer") throw new Error("Expected producer fixture.");

const createProject = (revision = 0): EditorProject => ({
	projectId: "project",
	title: editorTestConfig.meta.title,
	game: editorTestConfig.version,
	createdAtMs: 1,
	updatedAtMs: revision + 1,
	revision,
	config: {
		...editorTestConfig,
		items: {
			...editorTestConfig.items,
			[producer.id]: producer,
		},
	},
	resources: editorTestPayload.resources,
});

afterEach(() => {
	for (const registry of registries.splice(0)) registry.dispose();
});

describe("appendEditorItemLineFx", () => {
	it("appends and atomically publishes one valid inline-authored line", async () => {
		const registry = AtomRegistry.make({
			scheduleTask,
		});
		registries.push(registry);
		const projectAtom = EditorProjectAtom("project");
		registry.mount(projectAtom);
		registry.set(projectAtom, {
			project: createProject(),
		});
		const upsertItemFx = vi.fn<EditorProjectRepositoryService["upsertItemFx"]>(({ item }) => {
			const { resources: _resources, ...commit } = createProject(1);
			return Effect.succeed({
				...commit,
				config: {
					...commit.config,
					items: {
						...commit.config.items,
						[item.id]: item,
					},
				},
			});
		});
		const repository: EditorProjectRepositoryService = {
			awaitIdleFx: Effect.void,
			createProjectFx: () => Effect.die("Unexpected create."),
			listProjectsFx: Effect.die("Unexpected list."),
			readProjectFx: () => Effect.die("Unexpected read."),
			replaceConfigFx: () => Effect.die("Unexpected config save."),
			replaceResourceFx: () => Effect.die("Unexpected resource replacement."),
			upsertItemFx,
			upsertResourcesFx: () => Effect.die("Unexpected resource save."),
		};
		const nextLine: EditorLine = {
			...producer.lines[0],
			id: "line:academy:2",
			title: "Teaching",
			default: false,
		};

		const saved = await Effect.runPromise(
			appendEditorItemLineFx({
				item: producer,
				line: nextLine,
				projectId: "project",
			}).pipe(
				Effect.provideService(EditorProjectRepository, repository),
				Effect.provideService(AtomRegistry.AtomRegistry, registry),
			),
		);
		if (saved.type !== "producer") throw new Error("Expected saved producer.");

		expect(saved.lines).toEqual([
			producer.lines[0],
			nextLine,
		]);
		expect(upsertItemFx).toHaveBeenCalledWith({
			item: saved,
			projectId: "project",
		});
		expect(registry.get(projectAtom)?.revision).toBe(1);
	});

	it("replaces and atomically publishes one existing inline-authored line", async () => {
		const registry = AtomRegistry.make({
			scheduleTask,
		});
		registries.push(registry);
		const projectAtom = EditorProjectAtom("project");
		registry.mount(projectAtom);
		registry.set(projectAtom, {
			project: createProject(),
		});
		const upsertItemFx = vi.fn<EditorProjectRepositoryService["upsertItemFx"]>(({ item }) => {
			const { resources: _resources, ...commit } = createProject(1);
			return Effect.succeed({
				...commit,
				config: {
					...commit.config,
					items: {
						...commit.config.items,
						[item.id]: item,
					},
				},
			});
		});
		const repository: EditorProjectRepositoryService = {
			awaitIdleFx: Effect.void,
			createProjectFx: () => Effect.die("Unexpected create."),
			listProjectsFx: Effect.die("Unexpected list."),
			readProjectFx: () => Effect.die("Unexpected read."),
			replaceConfigFx: () => Effect.die("Unexpected config save."),
			replaceResourceFx: () => Effect.die("Unexpected resource replacement."),
			upsertItemFx,
			upsertResourcesFx: () => Effect.die("Unexpected resource save."),
		};
		const nextLine: EditorLine = {
			...producer.lines[0],
			title: "Applied research",
			runtimeMs: 2_500,
		};

		const saved = await Effect.runPromise(
			replaceEditorItemLineFx({
				item: producer,
				line: nextLine,
				projectId: "project",
			}).pipe(
				Effect.provideService(EditorProjectRepository, repository),
				Effect.provideService(AtomRegistry.AtomRegistry, registry),
			),
		);
		if (saved.type !== "producer") throw new Error("Expected saved producer.");

		expect(saved.lines).toEqual([
			nextLine,
		]);
		expect(upsertItemFx).toHaveBeenCalledWith({
			item: saved,
			projectId: "project",
		});
		expect(registry.get(projectAtom)?.revision).toBe(1);
	});
});
