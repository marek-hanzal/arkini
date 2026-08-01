import { describe, expect, it } from "vitest";

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { createEditorProjectConfig } from "~/bridge/project/editor/createEditorProjectConfig";
import {
	createEditorProjectFormSchema,
	readEditorProjectFormValues,
} from "~/bridge/project/editor/EditorProjectFormSchema";
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

		expect(readEditorProjectFormValues(project)).toEqual({
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
		const config = createEditorProjectConfig(project, {
			...readEditorProjectFormValues(project),
			title: "Updated project",
			hero: "item-water",
			avatars: [
				"hero",
			],
			toolbarSize: 3,
		});

		expect(config.meta.title).toBe("Updated project");
		expect(config.meta.id).toBe(project.config.meta.id);
		expect(config.meta.toolbarSize).toBe(3);
		expect(config.resources).toEqual({
			hero: "item-water",
			"avatar-01": "hero",
		});
		expect(config.start).toEqual(project.config.start);
		expect(config.items).toEqual(project.config.items);
	});

	it("rejects missing and duplicate appearance resources", () => {
		const project = createProject();
		const result = createEditorProjectFormSchema(project).safeParse({
			...readEditorProjectFormValues(project),
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
							space: 0,
							x: 1,
							y: 1,
						},
					],
					toolbar: [
						{
							itemId: "water",
							position: {
								x: 2,
								y: 0,
							},
						},
					],
				},
			},
		});
		const result = createEditorProjectFormSchema(project).safeParse({
			...readEditorProjectFormValues(project),
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
				"board",
			],
			[
				"toolbarSize",
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
		const result = createEditorProjectFormSchema(project).safeParse(
			readEditorProjectFormValues(project),
		);

		expect(result.success).toBe(false);
		if (result.success) return;
		expect(result.error.issues.map(({ path }) => path)).toEqual([
			[
				"inventory",
			],
		]);
	});
});
