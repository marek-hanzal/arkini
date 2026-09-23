import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, beforeEach, expect, it } from "vitest";
import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { createLine } from "~test/game-config-validation/support/gameValidationTestSource";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import {
	createProjectTestHarness,
	type ProjectTestHarness,
} from "./support/createProjectTestHarness";

let harness: ProjectTestHarness;
beforeEach(async () => {
	harness = await createProjectTestHarness("serakki-line-uids-");
});
afterEach(async () => harness.close());

it("rejects cross-item line UID collisions before item and config writes change disk or revision", async () => {
	const repository = await harness.openRepository();
	const project = await harness.createProject(repository);
	const line = createLine({
		uid: "shared-line",
	});
	const first = await Effect.runPromise(
		repository.upsertItemFx({
			projectId: project.projectId,
			expectedRevision: project.revision,
			item: {
				...project.config.items.water!,
				lines: [
					line,
				],
			},
		}),
	);
	const second = ItemSchema.parse({
		...first.config.items.water,
		uid: "other",
		title: "Other",
	});
	const root = await Effect.runPromise(repository.readProjectRootFx(project.projectId));
	if (root === null) throw new Error("Expected managed project root");
	const itemBefore = await readFile(join(root, "items", "water.json"), "utf8");
	const current = await Effect.runPromise(repository.readProjectFx(project.projectId));
	await expect(
		Effect.runPromise(
			repository.upsertItemFx({
				projectId: project.projectId,
				expectedRevision: first.revision,
				item: second,
			}),
		),
	).rejects.toThrow(
		'Line UID shared-line is duplicated at ["items","water","lines",0,"uid"] and ["items","other","lines",0,"uid"]',
	);
	await expect(
		Effect.runPromise(
			repository.replaceConfigFx({
				projectId: project.projectId,
				expectedRevision: first.revision,
				config: {
					...first.config,
					items: {
						...first.config.items,
						other: second,
					},
				},
			}),
		),
	).rejects.toThrow("Line UIDs must be unique across the project");
	expect(await Effect.runPromise(repository.readProjectFx(project.projectId))).toEqual(current);
	expect(await readFile(join(root, "items", "water.json"), "utf8")).toBe(itemBefore);
	expect(await readdir(join(root, "items"))).toEqual([
		"water.json",
	]);
	await harness.closeRepository(repository);
	const reopened = await harness.openRepository();
	expect(await Effect.runPromise(reopened.readProjectFx(project.projectId))).toEqual(current);
});

it("rejects duplicate UIDs before creating a managed project while allowing each owner its own Default", async () => {
	const repository = await harness.openRepository();
	const water = ItemSchema.parse({
		...editorTestPayload.config.items.water,
		lines: [
			createLine({
				uid: "shared-line",
				default: true,
			}),
		],
	});
	const other = ItemSchema.parse({
		...water,
		uid: "other",
		title: "Other",
	});
	const directoriesBefore = await readdir(harness.projectsRoot);
	const candidate = {
		version: {
			major: 1,
			minor: 0,
		},
		resources: editorTestPayload.resources,
		config: {
			...editorTestPayload.config,
			items: {
				water,
				other,
			},
		},
	};
	await expect(Effect.runPromise(repository.createProjectFx(candidate))).rejects.toThrow(
		"Line UID shared-line is duplicated",
	);
	expect(await readdir(harness.projectsRoot)).toEqual(directoriesBefore);
	const created = await Effect.runPromise(
		repository.createProjectFx({
			...candidate,
			config: {
				...candidate.config,
				items: {
					water,
					other: {
						...other,
						lines: [
							createLine({
								uid: "other-line",
								default: true,
							}),
						],
					},
				},
			},
		}),
	);
	expect(created.config.items.other?.lines[0]?.uid).toBe("other-line");
});

it("refuses externally authored duplicate line UIDs when opening a project", async () => {
	const root = await harness.createExternalProject("duplicate-lines");
	const file = join(root, "items", "water.json");
	const source = JSON.parse(await readFile(file, "utf8"));
	source.item.lines = [
		createLine({
			uid: "duplicate",
		}),
	];
	await writeFile(file, JSON.stringify(source));
	await writeFile(
		join(root, "items", "other.json"),
		JSON.stringify({
			...source,
			item: {
				...source.item,
				uid: "other",
			},
		}),
	);
	const repository = await harness.openRepository();
	await expect(
		Effect.runPromise(
			repository.openProjectFx({
				root,
			}),
		),
	).rejects.toMatchObject({
		operation: "import-json-directory",
		cause: {
			operation: "read-project",
			diagnostics: [
				expect.objectContaining({
					code: "line:duplicate-uid",
					lineUid: "duplicate",
					paths: [
						[
							"items",
							"other",
							"lines",
							0,
							"uid",
						],
						[
							"items",
							"water",
							"lines",
							0,
							"uid",
						],
					],
				}),
			],
		},
	});
	expect(await Effect.runPromise(repository.readProjectFx("duplicate-lines"))).toBeNull();
	expect(JSON.parse(await readFile(file, "utf8")).item.lines[0].uid).toBe("duplicate");
});
