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
	avatars: {
		"avatar-01": "",
		"avatar-02": "",
		"avatar-03": "",
		"avatar-04": "",
		"avatar-05": "",
		"avatar-06": "",
		"avatar-07": "",
		"avatar-08": "",
	},
	board: project.config.meta.board,
	templates: project.config.templates ?? [],
	start: project.config.start,
});

describe("ProjectFormSchema", () => {
	it("rejects unresolved template assignments while allowing shared templates", () => {
		const project = createProject();
		const value = createValidFormValue(project);
		const uid = value.templates[0]!.uid;
		const schema = createProjectFormSchema(project);
		expect(
			schema.safeParse({
				...value,
				start: {
					currentSpace: 0,
					spaces: [
						{
							space: 0,
							templateUid: uid,
						},
						{
							space: 1,
							templateUid: uid,
						},
					],
				},
			}).success,
		).toBe(true);
		expect(
			schema.safeParse({
				...value,
				start: {
					currentSpace: 0,
					spaces: [
						{
							space: 0,
							templateUid: "missing",
						},
					],
				},
			}).success,
		).toBe(false);
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
			avatars: {
				...createValidFormValue(project).avatars,
				"avatar-01": "hero",
				"avatar-03": "hero",
			},
		});

		expect(result.success).toBe(false);
		if (result.success) return;
		expect(result.error.issues.map(({ path }) => path)).toEqual([
			[
				"hero",
			],
			[
				"avatars",
				"avatar-03",
			],
		]);
	});

	it("keeps template dimensions independent from project defaults", () => {
		const project = createProject();
		const value = createValidFormValue(project);
		expect(
			createProjectFormSchema(project).safeParse({
				...value,
				board: {
					width: 1,
					height: 1,
				},
			}).success,
		).toBe(true);
	});
});
