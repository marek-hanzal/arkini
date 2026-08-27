import * as NodeServices from "@effect/platform-node/NodeServices";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
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
	it("retains concurrent updates from distinct catalog instances", async () => {
		const catalogPath = await createCatalogPath();
		const create = () =>
			Effect.runPromise(
				createFilesystemEditorProjectCatalogFx({
					catalogPath,
					projectsRoot: join(dirname(catalogPath), "projects"),
				}).pipe(Effect.provide(NodeServices.layer)),
			);
		const [left, right] = await Promise.all([
			create(),
			create(),
		]);
		await Promise.all([
			Effect.runPromise(
				left.addFx({
					root: join(dirname(catalogPath), "left"),
					ownership: "external",
					createdAtMs: 1,
				}),
			),
			Effect.runPromise(
				right.addFx({
					root: join(dirname(catalogPath), "right"),
					ownership: "external",
					createdAtMs: 2,
				}),
			),
		]);

		const stored = JSON.parse(await readFile(catalogPath, "utf8")) as {
			readonly projects: ReadonlyArray<{
				readonly root: string;
			}>;
		};
		expect(stored.projects.map(({ root }) => root).sort()).toEqual([
			join(dirname(catalogPath), "left"),
			join(dirname(catalogPath), "right"),
		]);
	});

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
				projectsRoot: join(dirname(catalogPath), "projects"),
			}).pipe(Effect.provide(NodeServices.layer)),
		);

		expect(catalog.list()).toEqual(expected.projects);
	});

	it("rebuilds an invalid catalog from direct managed directories and forgets externals", async () => {
		const catalogPath = await createCatalogPath();
		const projectsRoot = join(dirname(catalogPath), "projects");
		const managedRoots = [
			join(projectsRoot, "alpha"),
			join(projectsRoot, "broken"),
		];
		await Promise.all(
			managedRoots.map((root) =>
				mkdir(root, {
					recursive: true,
				}),
			),
		);
		await writeFile(join(managedRoots[1]!, "preserved.txt"), "keep");
		await writeFile(
			catalogPath,
			JSON.stringify({
				projects: [
					{
						root: join(dirname(catalogPath), "external"),
						ownership: "external",
						createdAtMs: 1,
					},
				],
				unexpected: true,
			}),
		);

		const catalog = await Effect.runPromise(
			createFilesystemEditorProjectCatalogFx({
				catalogPath,
				projectsRoot,
			}).pipe(Effect.provide(NodeServices.layer)),
		);

		expect(catalog.rebuilt).toBe(true);
		const canonicalManagedRoots = await Promise.all(managedRoots.map((root) => realpath(root)));
		expect(catalog.list()).toEqual(
			canonicalManagedRoots.map((root) => ({
				root,
				ownership: "managed",
				createdAtMs: 0,
			})),
		);
		expect(JSON.parse(await readFile(catalogPath, "utf8"))).toEqual({
			projects: catalog.list(),
		});
		expect(await readFile(join(managedRoots[1]!, "preserved.txt"), "utf8")).toBe("keep");
	});
});
