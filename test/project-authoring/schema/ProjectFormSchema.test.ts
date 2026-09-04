import { describe, expect, it } from "vitest";

import type { Project } from "~/project-authoring/type/Project";
import { createProjectFormSchema } from "~/project-authoring/schema/createProjectFormSchema";
import type { ProjectFormSchema } from "~/project-authoring/schema/ProjectFormSchema";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";

const createProject = (overrides?: Partial<Project>): Project => ({
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

const createInventoryProject = () =>
	createProject({
		config: GameConfigSchema.parse({
			...editorTestPayload.config,
			meta: {
				...editorTestPayload.config.meta,
				toolbarSize: 1,
			},
			items: {
				...editorTestPayload.config.items,
				backpack: {
					uid: "backpack",
					id: "backpack",
					type: "inventory",
					title: "Backpack",
					description: "Backpack",
					asset: {
						default: [
							"item-water",
						],
					},
					scope: "board",
					maxCount: 1,
					maxStackSize: 1,
				},
			},
		}),
	});

const createValidFormValue = (project: Project): ProjectFormSchema.Type => ({
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

describe("ProjectFormSchema", () => {
	it("limits Editor-authored Board, Inventory and Toolbar sizes to 42", () => {
		const project = createProject();
		const validValue = createValidFormValue(project);
		expect(
			createProjectFormSchema(project).safeParse({
				...validValue,
				board: {
					height: 42,
					width: 42,
				},
				inventory: {
					height: 42,
					width: 42,
				},
				toolbarSize: 42,
			}).success,
		).toBe(true);

		const result = createProjectFormSchema(project).safeParse({
			...validValue,
			board: {
				height: 43,
				width: 43,
			},
			inventory: {
				height: 43,
				width: 43,
			},
			toolbarSize: 43,
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
			[
				"inventory",
				"width",
			],
			[
				"inventory",
				"height",
			],
			[
				"toolbarSize",
			],
		]);
	});

	it("rejects missing and duplicate appearance resources", () => {
		const project = createProject();
		const result = createProjectFormSchema(project).safeParse({
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
		const result = createProjectFormSchema(project).safeParse({
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
				"board",
				"width",
			],
			[
				"toolbarSize",
			],
		]);
	});

	it("accepts the inventory control item in the initial toolbar", () => {
		const project = createInventoryProject();

		expect(
			createProjectFormSchema(project).safeParse({
				...createValidFormValue(project),
				start: {
					...createValidFormValue(project).start,
					toolbar: [
						{
							itemId: "backpack",
							position: {
								x: 0,
								y: 0,
							},
							quantity: 1,
						},
					],
				},
			}).success,
		).toBe(true);
	});

	it("rejects initial item quantities above the canonical max count across grids", () => {
		const project = createInventoryProject();
		const result = createProjectFormSchema(project).safeParse({
			...createValidFormValue(project),
			start: {
				currentSpace: 0,
				board: [
					{
						itemId: "backpack",
						quantity: 1,
						space: 0,
						x: 0,
						y: 0,
					},
				],
				inventory: [],
				toolbar: [
					{
						itemId: "backpack",
						position: {
							x: 0,
							y: 0,
						},
						quantity: 1,
					},
				],
			},
		});

		expect(result.success).toBe(false);
		if (result.success) return;
		expect(result.error.issues.map(({ path }) => path)).toContainEqual([
			"start",
			"toolbar",
			0,
		]);
	});
});
