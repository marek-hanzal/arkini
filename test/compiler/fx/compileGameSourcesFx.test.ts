import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { compileGameSourcesFx } from "~/engine/compiler/fx/compileGameSourcesFx";
import { GameSourceFileSchema } from "~/engine/source/schema/GameSourceFileSchema";
import {
	createRootSource,
	createSimpleItem,
} from "~test/validation/support/gameValidationTestSource";

const compile = (...sources: GameSourceFileSchema.Type[]) =>
	Effect.runPromise(compileGameSourcesFx(sources));

describe("compileGameSourcesFx", () => {
	it("produces one completed schema-valid game config", async () => {
		const item = createSimpleItem("item:a");
		const result = await compile(
			createRootSource({
				items: {
					[item.id]: item,
				},
			}),
		);

		expect(result.config?.items[item.id]).toEqual(item);
		expect(result.diagnostics).toEqual([]);
	});

	it("reports missing completed root fields instead of packing a fragment", async () => {
		const result = await compile(
			GameSourceFileSchema.parse({
				path: "/game/game.json",
				value: {
					version: "1.0",
					meta: {
						id: "game:test",
						title: "Test",
						board: {
							width: 1,
							height: 1,
						},
						inventory: {
							width: 1,
							height: 1,
						},
					},
					categories: {},
					items: {},
				},
			}),
		);

		expect(result.config).toBeUndefined();
		expect(result.diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "config:schema",
					path: [
						"start",
					],
				}),
			]),
		);
	});

	it("reports duplicate item keys with both source paths", async () => {
		const item = createSimpleItem("item:a");
		const result = await compile(
			createRootSource({
				items: {
					[item.id]: item,
				},
			}),
			GameSourceFileSchema.parse({
				path: "/game/items/a.json",
				value: {
					items: {
						[item.id]: item,
					},
				},
			}),
		);

		expect(result.diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "source:duplicate-record",
					entity: "item",
					key: item.id,
					sources: [
						"/game/game.json",
						"/game/items/a.json",
					],
				}),
			]),
		);
	});

	it("reports duplicate singleton providers", async () => {
		const result = await compile(
			createRootSource(),
			GameSourceFileSchema.parse({
				path: "/game/other.json",
				value: {
					meta: {
						id: "game:other",
						title: "Other",
						board: {
							width: 1,
							height: 1,
						},
						inventory: {
							width: 1,
							height: 1,
						},
					},
				},
			}),
		);

		expect(result.diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "source:duplicate-provider",
					provider: "meta",
				}),
			]),
		);
	});

	it("accepts equivalent relative JSON Schema references", async () => {
		const result = await compile(
			createRootSource(),
			GameSourceFileSchema.parse({
				path: "/game/items/a.json",
				value: {
					$schema: "../../schema.json",
					items: {},
				},
			}),
		);

		expect(result.diagnostics).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "source:schema-reference-conflict",
				}),
			]),
		);
		expect(result.config?.$schema).toBe("../schema.json");
	});
	it("requires explicit completed collection providers", async () => {
		const result = await compile(
			GameSourceFileSchema.parse({
				path: "/game/game.json",
				value: {
					version: "1.0",
					meta: {
						id: "game:test",
						title: "Test",
						board: {
							width: 1,
							height: 1,
						},
						inventory: {
							width: 1,
							height: 1,
						},
					},
					start: {
						currentSpace: 0,
						board: [],
						inventory: [],
					},
				},
			}),
		);

		expect(result.config).toBeUndefined();
		expect(result.diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "config:schema",
					path: [
						"categories",
					],
				}),
				expect.objectContaining({
					code: "config:schema",
					path: [
						"items",
					],
				}),
			]),
		);
	});

	it("accepts explicit empty completed collections", async () => {
		const result = await compile(createRootSource());

		expect(result.config?.categories).toEqual({
			"category:test": {
				id: "category:test",
				title: "Test",
			},
		});
		expect(result.config?.items).toEqual({});
	});

	it("reports duplicate category keys with both source paths", async () => {
		const result = await compile(
			createRootSource(),
			GameSourceFileSchema.parse({
				path: "/game/categories/test.json",
				value: {
					categories: {
						"category:test": {
							id: "category:test",
							title: "Other",
						},
					},
				},
			}),
		);

		expect(result.diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "source:duplicate-record",
					entity: "category",
					key: "category:test",
					sources: [
						"/game/game.json",
						"/game/categories/test.json",
					],
				}),
			]),
		);
	});

	it("reports JSON Schema references resolving to different targets", async () => {
		const result = await compile(
			createRootSource(),
			GameSourceFileSchema.parse({
				path: "/game/items/a.json",
				value: {
					$schema: "../different-schema.json",
					items: {},
				},
			}),
		);

		expect(result.diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "source:schema-reference-conflict",
					sources: [
						"/game/game.json",
						"/game/items/a.json",
					],
				}),
			]),
		);
	});
});
