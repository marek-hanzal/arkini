import { describe, expect, it } from "vitest";

import type { EditorProject } from "~/project-authoring/type/EditorProject";
import { createEditorProjectFormSchema } from "~/project-authoring/schema/createEditorProjectFormSchema";
import type { EditorProjectFormSchema } from "~/project-authoring/schema/EditorProjectFormSchema";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";

const createProject = (overrides?: Partial<EditorProject>): EditorProject => ({
	projectId: "project",
	title: editorTestPayload.config.meta.title,
	version: editorTestPayload.version,
	createdAtMs: 1,
	updatedAtMs: 2,
	revision: 0,
	config: editorTestPayload.config,
	resources: editorTestPayload.resources,
	...overrides,
});

const createValidFormValue = (project: EditorProject): EditorProjectFormSchema.Type => ({
	title: project.config.meta.title,
	hero: project.config.resources.hero,
	avatars: [],
	board: project.config.meta.board,
	inventory: project.config.meta.inventory,
	toolbarSize: project.config.meta.toolbarSize ?? 0,
	start: {
		...project.config.start,
		board: project.config.start.board.map((entry) => ({
			...entry,
			quantity: entry.quantity ?? 1,
		})),
		inventory: project.config.start.inventory.map((entry) => ({
			...entry,
			quantity: entry.quantity ?? 1,
		})),
		toolbar: project.config.start.toolbar.map((entry) => ({
			...entry,
			quantity: entry.quantity ?? 1,
		})),
	},
});

describe("EditorProjectFormSchema", () => {
	it("rejects missing and duplicate appearance resources", () => {
		const project = createProject();
		const result = createEditorProjectFormSchema(project).safeParse({
			...createValidFormValue(project),
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
		const result = createEditorProjectFormSchema(project).safeParse({
			...createValidFormValue(project),
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
});
