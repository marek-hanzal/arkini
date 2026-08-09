import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { createEditorProjectConfigFx } from "~/bridge/project/editor/createEditorProjectConfigFx";
import { createEditorProjectFormSchemaFx } from "~/bridge/project/editor/createEditorProjectFormSchemaFx";
import { readEditorProjectFormValuesFx } from "~/bridge/project/editor/readEditorProjectFormValuesFx";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";

const createProject = (overrides?: Partial<EditorProject>): EditorProject => ({
	projectId: "project",
	title: editorTestPayload.config.meta.title,
	game: editorTestPayload.config.version,
	createdAtMs: 1,
	updatedAtMs: 2,
	revision: 0,
	config: editorTestPayload.config,
	resources: editorTestPayload.resources,
	...overrides,
});

describe("EditorProjectFormSchema", () => {
	it("projects canonical appearance and layout fields into one form", () => {
		const project = createProject({
			config: {
				...editorTestPayload.config,
				resources: {
					hero: "hero",
					"avatar-01": "item-water",
				},
				meta: {
					...editorTestPayload.config.meta,
					toolbarSize: 4,
				},
			},
		});

		expect(Effect.runSync(readEditorProjectFormValuesFx(project))).toEqual({
			title: "Editor test",
			hero: "hero",
			avatars: [
				"item-water",
			],
			board: {
				width: 2,
				height: 2,
			},
			inventory: {
				width: 1,
				height: 1,
			},
			toolbarSize: 4,
			start: {
				currentSpace: 0,
				board: [
					{
						itemId: "water",
						quantity: 1,
						space: 0,
						x: 0,
						y: 0,
					},
				],
				inventory: [],
				toolbar: [],
			},
		});
	});

	it("rebuilds one canonical config while preserving unrelated project facts", () => {
		const project = createProject({
			config: {
				...editorTestPayload.config,
				resources: {
					hero: "hero",
					"avatar-01": "item-water",
					"avatar-03": "hero",
				},
			},
		});
		const config = Effect.runSync(
			createEditorProjectConfigFx(project, {
				...Effect.runSync(readEditorProjectFormValuesFx(project)),
				title: "Updated project",
				hero: "item-water",
				avatars: [
					"hero",
				],
				toolbarSize: 3,
			}),
		);

		expect(config.meta.title).toBe("Updated project");
		expect(config.meta.id).toBe(project.config.meta.id);
		expect(config.meta.toolbarSize).toBe(3);
		expect(config.resources).toEqual({
			hero: "item-water",
			"avatar-01": "hero",
		});
		expect(config.start).toEqual({
			currentSpace: 0,
			board: [
				{
					itemId: "water",
					quantity: 1,
					space: 0,
					x: 0,
					y: 0,
				},
			],
			inventory: [],
			toolbar: [],
		});
		expect(config.items).toEqual(project.config.items);
	});

	it("round-trips exact initial stacks across every editable surface", () => {
		const project = createProject({
			config: {
				...editorTestPayload.config,
				meta: {
					...editorTestPayload.config.meta,
					toolbarSize: 2,
				},
				start: {
					currentSpace: 0,
					board: [
						{
							itemId: "water",
							quantity: 2,
							space: 0,
							x: 1,
							y: 0,
						},
					],
					inventory: [
						{
							itemId: "water",
							position: {
								x: 0,
								y: 0,
							},
							quantity: 3,
						},
					],
					toolbar: [
						{
							itemId: "water",
							position: {
								x: 1,
								y: 0,
							},
							quantity: 4,
						},
					],
				},
			},
		});
		const values = Effect.runSync(readEditorProjectFormValuesFx(project));
		const config = Effect.runSync(createEditorProjectConfigFx(project, values));

		expect(config.start).toEqual(project.config.start);
	});

	it("rejects missing and duplicate appearance resources", () => {
		const project = createProject();
		const result = Effect.runSync(createEditorProjectFormSchemaFx(project)).safeParse({
			...Effect.runSync(readEditorProjectFormValuesFx(project)),
			hero: "missing",
			avatars: [
				"item-water",
				"item-water",
			],
		});

		expect(result.success).toBe(false);
		if (result.success) return;
		expect(result.error.issues.map(({ path }) => path)).toEqual([
			[
				"hero",
			],
			[
				"avatars",
				1,
			],
		]);
	});

	it("rejects layout changes that orphan explicit start placements", () => {
		const project = createProject({
			config: {
				...editorTestPayload.config,
				start: {
					...editorTestPayload.config.start,
					board: [
						{
							itemId: "water",
							quantity: 1,
							space: 0,
							x: 1,
							y: 1,
						},
					],
					toolbar: [
						{
							itemId: "water",
							quantity: 1,
							position: {
								x: 2,
								y: 0,
							},
						},
					],
				},
			},
		});
		const result = Effect.runSync(createEditorProjectFormSchemaFx(project)).safeParse({
			...Effect.runSync(readEditorProjectFormValuesFx(project)),
			board: {
				width: 1,
				height: 1,
			},
			toolbarSize: 2,
		});

		expect(result.success).toBe(false);
		if (result.success) return;
		expect(result.error.issues.map(({ path }) => path)).toEqual([
			[
				"start",
				"board",
				0,
			],
			[
				"start",
				"toolbar",
				0,
			],
		]);
	});

	it("rejects inventory dimensions that cannot hold the initial item stacks", () => {
		const project = createProject({
			config: {
				...editorTestPayload.config,
				start: {
					...editorTestPayload.config.start,
					inventory: [
						{
							itemId: "water",
							quantity: 11,
						},
					],
				},
			},
		});
		const result = Effect.runSync(createEditorProjectFormSchemaFx(project)).safeParse(
			Effect.runSync(readEditorProjectFormValuesFx(project)),
		);

		expect(result.success).toBe(false);
		if (result.success) return;
		expect(result.error.issues.map(({ path }) => path)).toEqual([
			[
				"start",
				"inventory",
				1,
			],
		]);
	});

	it("preserves overflow legacy inventory items as exact out-of-bounds stacks", () => {
		const project = createProject({
			config: {
				...editorTestPayload.config,
				start: {
					...editorTestPayload.config.start,
					inventory: [
						{
							itemId: "water",
							quantity: 10,
						},
						{
							itemId: "other",
							quantity: 2,
						},
					],
				},
				items: {
					...editorTestPayload.config.items,
					other: {
						...editorTestPayload.config.items.water,
						id: "other",
						maxStackSize: 2,
						title: "Other",
					},
				},
			},
		});

		expect(Effect.runSync(readEditorProjectFormValuesFx(project)).start.inventory).toEqual([
			{
				itemId: "water",
				position: {
					x: 0,
					y: 0,
				},
				quantity: 10,
			},
			{
				itemId: "other",
				position: {
					x: 0,
					y: 1,
				},
				quantity: 2,
			},
		]);
	});

	it("normalizes legacy inventory quantities into exact row-major start slots", () => {
		const project = createProject({
			config: {
				...editorTestPayload.config,
				meta: {
					...editorTestPayload.config.meta,
					inventory: {
						width: 2,
						height: 1,
					},
				},
				start: {
					...editorTestPayload.config.start,
					inventory: [
						{
							itemId: "water",
							quantity: 11,
						},
					],
				},
			},
		});

		expect(Effect.runSync(readEditorProjectFormValuesFx(project)).start.inventory).toEqual([
			{
				itemId: "water",
				position: {
					x: 0,
					y: 0,
				},
				quantity: 10,
			},
			{
				itemId: "water",
				position: {
					x: 1,
					y: 0,
				},
				quantity: 1,
			},
		]);
	});
});
