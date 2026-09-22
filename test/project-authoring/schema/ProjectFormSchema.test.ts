import { describe, expect, it } from "vitest";

import type { Project } from "~/project-authoring/type/Project";
import { createProjectFormSchema } from "~/project-authoring/schema/createProjectFormSchema";
import type { ProjectFormSchema } from "~/project-authoring/schema/ProjectFormSchema";
import {
	editorTestResources,
	editorTestPayload,
} from "~test/project-authoring/support/editorTestPayload";

const createProject = (overrides?: Partial<Project>): Project => ({
	projectId: "project",
	title: editorTestPayload.config.meta.title,
	version: {
		major: 1,
		minor: 0,
	},
	createdAtMs: 1,
	updatedAtMs: 2,
	revision: 0,
	config: editorTestPayload.config,
	resources: editorTestResources,
	...overrides,
});

const createValidFormValue = (project: Project): ProjectFormSchema.Type => ({
	title: project.config.meta.title,
	introduction: project.config.meta.introduction ?? "",
	hero: project.config.resources.hero,
	avatars: [],
	board: project.config.meta.board,
	start: {
		...project.config.start,
		board: project.config.start.board.map((entry) => ({
			...entry,
			quantity: entry.quantity ?? 1,
		})),
	},
});

describe("ProjectFormSchema", () => {
	it("rejects two different items in one Board cell while the same coordinate in another Space stays available", () => {
		const project = createProject();
		const stone = {
			...project.config.items.water!,
			id: "stone",
			uid: "stone",
		};
		const schema = createProjectFormSchema({
			...project,
			config: {
				...project.config,
				items: {
					...project.config.items,
					stone,
				},
			},
		});
		const value = {
			...createValidFormValue(project),
			start: {
				...createValidFormValue(project).start,
				board: [
					{
						itemId: "water",
						quantity: 1,
						space: 0,
						x: 0,
						y: 0,
					},
					{
						itemId: "stone",
						quantity: 1,
						space: 1,
						x: 0,
						y: 0,
					},
				],
			},
		};
		expect(schema.safeParse(value).success).toBe(true);
		const result = schema.safeParse({
			...value,
			start: {
				...value.start,
				board: [
					...value.start.board,
					{
						itemId: "stone",
						quantity: 1,
						space: 0,
						x: 0,
						y: 0,
					},
				],
			},
		});
		expect(result.success).toBe(false);
		if (result.success) throw new Error("Expected occupied-cell rejection.");
		expect(result.error.issues.map((issue) => issue.path)).toEqual([
			[
				"start",
				"board",
				2,
			],
		]);
	});

	it("limits Editor-authored Board sizes to 42", () => {
		const project = createProject();
		const validValue = createValidFormValue(project);
		expect(
			createProjectFormSchema(project).safeParse({
				...validValue,
				board: {
					height: 42,
					width: 42,
				},
			}).success,
		).toBe(true);

		const result = createProjectFormSchema(project).safeParse({
			...validValue,
			board: {
				height: 43,
				width: 43,
			},
		});

		expect(result.success).toBe(false);
		if (result.success) return;
		expect(result.error.issues.map(({ path }) => path)).toEqual([
			[
				"board",
				"width",
			],
			[
				"board",
				"height",
			],
		]);
	});

	it("rejects missing and duplicate appearance resources", () => {
		const project = createProject();
		const result = createProjectFormSchema(project).safeParse({
			...createValidFormValue(project),
			hero: "missing",
			avatars: [
				"hero",
				"hero",
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
				},
			},
		});
		const result = createProjectFormSchema(project).safeParse({
			...createValidFormValue(project),
			board: {
				width: 1,
				height: 1,
			},
		});

		expect(result.success).toBe(false);
		if (result.success) return;
		expect(result.error.issues.map(({ path }) => path)).toEqual([
			[
				"board",
				"width",
			],
		]);
	});
});
