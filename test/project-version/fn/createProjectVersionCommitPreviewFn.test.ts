import { describe, expect, it } from "vitest";

import { createProjectVersionCommitPreviewFn } from "~/project-version/fn/createProjectVersionCommitPreviewFn";
import type { ProjectVersionDiff } from "~/project-version/type/ProjectVersion";

const createDiff = (
	changes: Partial<Pick<ProjectVersionDiff, "project" | "items" | "resources" | "scenarios">>,
): ProjectVersionDiff => ({
	from: {
		type: "version",
		versionId: "parent",
	},
	to: {
		type: "current",
	},
	hasChanges: true,
	project: [],
	items: [],
	resources: [],
	scenarios: [],
	...changes,
});

describe("createProjectVersionCommitPreviewFn", () => {
	it("keeps the initial snapshot version unchanged", () => {
		expect(
			createProjectVersionCommitPreviewFn({
				baseArkpackVersion: "1.0",
				currentFingerprint: "a".repeat(64),
				currentScenarioNames: [
					"Opening",
				],
			}),
		).toEqual({
			bump: "noop",
			canCommit: true,
			currentFingerprint: "a".repeat(64),
			initial: true,
			nextArkpackVersion: "1.0",
			scenariosToDelete: [],
		});
	});

	it("collapses every gameplay change into one strongest bump", () => {
		const diff = createDiff({
			project: [
				{
					path: "config.meta.title",
					bump: "minor",
				},
			],
			items: [
				{
					change: "changed",
					uid: "water",
					values: [
						{
							path: "id",
							bump: "major",
						},
					],
				},
			],
		});

		expect(
			createProjectVersionCommitPreviewFn({
				baseArkpackVersion: "1.7",
				currentFingerprint: "b".repeat(64),
				currentScenarioNames: [
					"Variant",
					"Opening",
				],
				diff,
			}),
		).toEqual({
			bump: "major",
			canCommit: true,
			currentFingerprint: "b".repeat(64),
			diff,
			initial: false,
			nextArkpackVersion: "2.0",
			scenariosToDelete: [
				"Opening",
				"Variant",
			],
		});
	});

	it("commits scenario-only changes without changing the Arkpack version", () => {
		const diff = createDiff({
			scenarios: [
				{
					change: "added",
					id: "Opening",
				},
			],
		});

		expect(
			createProjectVersionCommitPreviewFn({
				baseArkpackVersion: "4.2",
				currentFingerprint: "c".repeat(64),
				currentScenarioNames: [
					"Opening",
				],
				diff,
			}),
		).toMatchObject({
			bump: "noop",
			initial: false,
			nextArkpackVersion: "4.2",
			scenariosToDelete: [],
		});
	});

	it("marks an unchanged parent snapshot as not committable", () => {
		const diff = {
			...createDiff({}),
			hasChanges: false,
		};
		expect(
			createProjectVersionCommitPreviewFn({
				baseArkpackVersion: "4.2",
				currentFingerprint: "d".repeat(64),
				currentScenarioNames: [],
				diff,
			}),
		).toMatchObject({
			bump: "noop",
			canCommit: false,
			currentFingerprint: "d".repeat(64),
			nextArkpackVersion: "4.2",
		});
	});
});
