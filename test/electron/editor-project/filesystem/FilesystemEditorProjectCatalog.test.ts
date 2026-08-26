import * as NodeServices from "@effect/platform-node/NodeServices";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";

import { createFilesystemEditorProjectCatalogFx } from "../../../../electron/main/editor-project/filesystem/fx/createFilesystemEditorProjectCatalogFx";

const temporaryDirectories: Array<string> = [];

const createCatalogPath = async () => {
	const root = await mkdtemp(join(tmpdir(), "arkini-project-catalog-"));
	temporaryDirectories.push(root);
	const catalogPath = join(root, "user-data", "projects.json");
	await mkdir(dirname(catalogPath), {
		recursive: true,
	});
	return catalogPath;
};

afterEach(async () => {
	await Promise.all(
		temporaryDirectories.splice(0).map((root) =>
			rm(root, {
				force: true,
				recursive: true,
			}),
		),
	);
});

describe("filesystem Editor project catalog", () => {
	it("opens the exact current catalog envelope", async () => {
		const catalogPath = await createCatalogPath();
		const expected = {
			projects: [
				{
					root: join(dirname(catalogPath), "external-project"),
					ownership: "external",
					createdAtMs: 1,
				},
			],
		};
		await writeFile(catalogPath, JSON.stringify(expected));

		const catalog = await Effect.runPromise(
			createFilesystemEditorProjectCatalogFx({
				catalogPath,
			}).pipe(Effect.provide(NodeServices.layer)),
		);

		expect(catalog.list()).toEqual(expected.projects);
	});

	it("rejects an undeclared root property without rewriting the catalog", async () => {
		const catalogPath = await createCatalogPath();
		const source = JSON.stringify({
			projects: [],
			unexpected: true,
		});
		await writeFile(catalogPath, source);

		await expect(
			Effect.runPromise(
				createFilesystemEditorProjectCatalogFx({
					catalogPath,
				}).pipe(Effect.provide(NodeServices.layer)),
			),
		).rejects.toMatchObject({
			_tag: "EditorProjectRepositoryError",
			operation: "list-projects",
			message: "The Editor project catalog is invalid.",
		});
		expect(await readFile(catalogPath, "utf8")).toBe(source);
	});

	it("rejects duplicate project roots without rewriting the catalog", async () => {
		const catalogPath = await createCatalogPath();
		const project = {
			root: join(dirname(catalogPath), "external-project"),
			ownership: "external",
			createdAtMs: 1,
		};
		const source = JSON.stringify({
			projects: [
				project,
				project,
			],
		});
		await writeFile(catalogPath, source);

		await expect(
			Effect.runPromise(
				createFilesystemEditorProjectCatalogFx({
					catalogPath,
				}).pipe(Effect.provide(NodeServices.layer)),
			),
		).rejects.toMatchObject({
			_tag: "EditorProjectRepositoryError",
			operation: "list-projects",
			message: "The Editor project catalog is invalid.",
		});
		expect(await readFile(catalogPath, "utf8")).toBe(source);
	});
});
