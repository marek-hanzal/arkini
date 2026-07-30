import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { compileEditorProjectFilesFx } from "~/engine/editor/fx/compileEditorProjectFilesFx";
import { createEditorProjectPlanFx } from "~/engine/editor/fx/createEditorProjectPlanFx";
import { editorTestConfig, editorTestPayload } from "~test/editor/support/editorTestPayload";

describe("createEditorProjectPlanFx", () => {
	it("expands and recompiles one arkpack as stable standalone source files", async () => {
		const plan = await Effect.runPromise(
			createEditorProjectPlanFx({
				contentHash: "a".repeat(64),
				payload: editorTestPayload,
			}),
		);

		expect(plan.projectId).toBe("editor-test");
		expect(plan.title).toBe("Editor test");
		expect(plan.version).toBe("1.0");
		expect(plan.files.map(({ path }) => path)).toEqual([
			"assets/item-water.png",
			"game.json",
			"resources/hero.png",
			"simple/water.json",
		]);
		const gameFile = plan.files.find(({ path }) => path === "game.json");
		if (gameFile === undefined) throw new Error("Expected game.json in editor project plan.");
		expect(JSON.parse(new TextDecoder().decode(gameFile.bytes))).toEqual({
			meta: editorTestConfig.meta,
			resources: editorTestConfig.resources,
			start: editorTestConfig.start,
			categories: editorTestConfig.categories,
			version: editorTestConfig.version,
		});

		const compilation = await Effect.runPromise(compileEditorProjectFilesFx(plan.files));
		expect(compilation.payload.config).toEqual(editorTestConfig);
		expect(
			Object.fromEntries(
				compilation.payload.resources.map((resource) => [
					resource.id,
					resource.bytes,
				]),
			),
		).toEqual({
			hero: new Uint8Array([
				1,
				2,
			]),
			"item-water": new Uint8Array([
				3,
				4,
			]),
		});
		expect(compilation.diagnostics).toEqual([]);
	});

	it("derives stable portable project and item paths without trusting authored IDs as paths", async () => {
		const payload = {
			...editorTestPayload,
			config: {
				...editorTestPayload.config,
				meta: {
					...editorTestPayload.config.meta,
					id: "../Unsafe project",
				},
				items: {
					"water/rare": {
						...editorTestPayload.config.items.water,
						id: "water/rare",
					},
				},
			},
		};
		const first = await Effect.runPromise(
			createEditorProjectPlanFx({
				contentHash: "b".repeat(64),
				payload,
			}),
		);
		const second = await Effect.runPromise(
			createEditorProjectPlanFx({
				contentHash: "b".repeat(64),
				payload,
			}),
		);

		expect(first.projectId).toBe("Unsafe-project-bbbbbbbbbbbb");
		expect(first.files.map(({ path }) => path)).toEqual(second.files.map(({ path }) => path));
		expect(first.files.map(({ path }) => path)).toEqual(
			expect.arrayContaining([
				"simple/water-rare.json",
			]),
		);
		expect(first.files.every(({ path }) => !path.includes(".."))).toBe(true);
	});

	it("adds stable hashes only when readable item filenames collide", async () => {
		const payload = {
			...editorTestPayload,
			config: {
				...editorTestPayload.config,
				items: {
					"item:water": {
						...editorTestPayload.config.items.water,
						id: "item:water",
					},
					"item:water?": {
						...editorTestPayload.config.items.water,
						id: "item:water?",
					},
				},
			},
		};
		const plan = await Effect.runPromise(
			createEditorProjectPlanFx({
				contentHash: "c".repeat(64),
				payload,
			}),
		);

		expect(plan.files.map(({ path }) => path)).toEqual(
			expect.arrayContaining([
				expect.stringMatching(/^simple\/water-[a-f0-9]{16}\.json$/),
			]),
		);
		expect(
			plan.files.filter(({ path }) => /^simple\/water-[a-f0-9]{16}\.json$/.test(path)),
		).toHaveLength(2);
	});

	it("keeps generated workspace IDs portable after truncating a readable prefix", async () => {
		const gameId = `${"a".repeat(95)}.${"b".repeat(40)}`;
		const payload = {
			...editorTestPayload,
			config: {
				...editorTestPayload.config,
				meta: {
					...editorTestPayload.config.meta,
					id: gameId,
				},
			},
		};
		const plan = await Effect.runPromise(
			createEditorProjectPlanFx({
				contentHash: "e".repeat(64),
				payload,
			}),
		);

		expect(plan.projectId).toMatch(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/);
		expect(plan.projectId).not.toContain(".-");
		expect(plan.projectId.endsWith("-eeeeeeeeeeee")).toBe(true);
	});

	it("prefixes readable workspace and item stems that start outside the portable alphabet", async () => {
		const payload = {
			...editorTestPayload,
			config: {
				...editorTestPayload.config,
				meta: {
					...editorTestPayload.config.meta,
					id: "_workspace",
				},
				items: {
					_item: {
						...editorTestPayload.config.items.water,
						id: "_item",
					},
				},
			},
		};
		const plan = await Effect.runPromise(
			createEditorProjectPlanFx({
				contentHash: "e".repeat(64),
				payload,
			}),
		);

		expect(plan.projectId).toBe("project-_workspace-eeeeeeeeeeee");
		expect(plan.files.map(({ path }) => path)).toContain("simple/item-_item.json");
	});

	it("disambiguates item paths that differ only by filesystem case", async () => {
		const payload = {
			...editorTestPayload,
			config: {
				...editorTestPayload.config,
				items: {
					Water: {
						...editorTestPayload.config.items.water,
						id: "Water",
					},
					water: editorTestPayload.config.items.water,
				},
			},
		};
		const plan = await Effect.runPromise(
			createEditorProjectPlanFx({
				contentHash: "f".repeat(64),
				payload,
			}),
		);
		const itemPaths = plan.files
			.map(({ path }) => path)
			.filter((path) => path.startsWith("simple/"));

		expect(itemPaths).toHaveLength(2);
		expect(new Set(itemPaths.map((path) => path.toLowerCase())).size).toBe(2);
		expect(
			itemPaths.every((path) => /^simple\/(?:Water|water)-[a-f0-9]{16}\.json$/.test(path)),
		).toBe(true);
	});

	it("rejects source paths that collide on case-insensitive filesystems", async () => {
		const payload = {
			...editorTestPayload,
			resources: [
				...editorTestPayload.resources,
				{
					id: "ITEM-WATER",
					mime: "image/png" as const,
					bytes: new Uint8Array([
						5,
						6,
					]),
				},
			],
		};

		await expect(
			Effect.runPromise(
				createEditorProjectPlanFx({
					contentHash: "c".repeat(64),
					payload,
				}),
			),
		).rejects.toThrow("collide on a case-insensitive filesystem");
	});

	it("rejects resource IDs that cannot remain exact portable filenames", async () => {
		const payload = {
			...editorTestPayload,
			config: {
				...editorTestPayload.config,
				resources: {
					hero: "CON",
				},
			},
			resources: editorTestPayload.resources.map((resource) =>
				resource.id === "hero"
					? {
							...resource,
							id: "CON",
						}
					: resource,
			),
		};

		await expect(
			Effect.runPromise(
				createEditorProjectPlanFx({
					contentHash: "d".repeat(64),
					payload,
				}),
			),
		).rejects.toThrow("cannot be represented by the filename-based source format");
	});
});
