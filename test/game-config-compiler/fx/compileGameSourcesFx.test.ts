import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { compileGameSourcesFx } from "~/game-config-compiler/fx/compileGameSourcesFx";
import { GameSourceFileSchema } from "~/game-config-source/schema/GameSourceFileSchema";
import {
	createLine,
	createProducerItem,
	createRootSource,
	createSimpleItem,
} from "~test/game-config-validation/support/gameValidationTestSource";
import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticRecordEntityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticRecordEntityEnumSchema";
import { DiagnosticProviderEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticProviderEnumSchema";

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

	it("preserves the complete default composition and ordered progress sources", async () => {
		const item = {
			...createSimpleItem("item:layered"),
			asset: {
				default: [
					"asset:base",
					"asset:overlay",
				],
				sources: [
					"asset:progress-1",
					"asset:progress-2",
				],
			},
		};
		const result = await compile(
			createRootSource({
				items: {
					[item.id]: item,
				},
			}),
		);

		expect(result.config?.items[item.id]?.asset).toEqual(item.asset);
		expect(result.diagnostics).toEqual([]);
	});

	it("preserves an authored default line through the compiler used by packing", async () => {
		const item = createProducerItem({
			id: "item:producer",
			lines: [
				createLine({
					default: true,
					id: "line:default",
				}),
			],
		});
		const result = await compile(
			createRootSource({
				items: {
					[item.id]: item,
				},
			}),
		);
		const compiled = result.config?.items[item.id];
		if (compiled?.type !== "producer") {
			throw new Error("Expected compiled producer.");
		}

		expect(compiled.lines[0]?.default).toBe(true);
		expect(result.diagnostics).toEqual([]);
	});

	it("reports an unknown exact toolbar start item at its source path", async () => {
		const result = await compile(
			createRootSource({
				start: {
					currentSpace: 0,
					board: [],
					inventory: [],
					toolbar: [
						{
							itemId: "item:missing",
							position: {
								x: 0,
								y: 0,
							},
						},
					],
				},
			}),
		);

		expect(result.diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: DiagnosticCodeEnumSchema.enum.ConfigMissingReference,
					path: [
						"start",
						"toolbar",
						0,
						"itemId",
					],
					source: "/game/game.json",
				}),
			]),
		);
	});

	it("reports missing completed root fields instead of packing a fragment", async () => {
		const result = await compile(
			GameSourceFileSchema.parse({
				path: "/game/game.json",
				value: {
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
					items: {},
				},
			}),
		);

		expect(result.config).toBeUndefined();
		expect(result.diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: DiagnosticCodeEnumSchema.enum.ConfigSchema,
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
					code: DiagnosticCodeEnumSchema.enum.SourceDuplicateRecord,
					entity: DiagnosticRecordEntityEnumSchema.enum.Item,
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
					code: DiagnosticCodeEnumSchema.enum.SourceDuplicateProvider,
					provider: DiagnosticProviderEnumSchema.enum.Meta,
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
					code: DiagnosticCodeEnumSchema.enum.SourceSchemaReferenceConflict,
				}),
			]),
		);
		expect(result.config?.$schema).toBe("../schema.json");
	});

	it("accepts equivalent portable relative JSON Schema references", async () => {
		const result = await compile(
			createRootSource({
				path: "game.json",
			}),
			GameSourceFileSchema.parse({
				path: "simple/a.json",
				value: {
					$schema: "../../schema.json",
				},
			}),
		);

		expect(result.diagnostics).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: DiagnosticCodeEnumSchema.enum.SourceSchemaReferenceConflict,
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
					code: DiagnosticCodeEnumSchema.enum.ConfigSchema,
					path: [
						"items",
					],
				}),
			]),
		);
	});

	it("accepts explicit empty completed collections", async () => {
		const result = await compile(createRootSource());

		expect(result.config?.items).toEqual({});
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
					code: DiagnosticCodeEnumSchema.enum.SourceSchemaReferenceConflict,
					sources: [
						"/game/game.json",
						"/game/items/a.json",
					],
				}),
			]),
		);
	});
});
