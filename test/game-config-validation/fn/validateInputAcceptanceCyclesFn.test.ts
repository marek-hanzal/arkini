import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { compileGameSourcesFx } from "~/game-config-compiler/fx/compileGameSourcesFx";
import { GameSourceFileSchema } from "~/game-config-source/schema/GameSourceFileSchema";
import type { SelectorSchema } from "~/item-definition/schema/SelectorSchema";
import {
	createProducerItem,
	createRootSource,
	createSimpleItem,
} from "~test/game-config-validation/support/gameValidationTestSource";
import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";

const materials = (selector: SelectorSchema.Type) => [
	{
		type: "materials" as const,
		query: {
			distance: "far" as const,
			selector,
		},
		quantity: {
			min: 1,
			max: 1,
		},
		mode: "consume" as const,
	},
];

const compileItems = (items: Record<string, unknown>) =>
	Effect.runPromise(
		compileGameSourcesFx([
			createRootSource({
				items,
			}),
		]),
	);

const cycleDiagnostics = async (items: Record<string, unknown>) =>
	(await compileItems(items)).diagnostics.filter(
		({ code }) => code === DiagnosticCodeEnumSchema.enum.InputAcceptanceCycle,
	);

describe("validateInputAcceptanceCyclesFn", () => {
	it("rejects a material input self-loop", async () => {
		const item = createProducerItem({
			id: "item:a",
			input: materials({
				type: "item",
				itemUid: "item:a",
			}),
		});

		expect(
			await cycleDiagnostics({
				[item.uid]: item,
			}),
		).toEqual([
			expect.objectContaining({
				cycle: [
					"item:a",
					"item:a",
				],
			}),
		]);
	});

	it("rejects a direct reciprocal pair with the full cycle path", async () => {
		const a = createProducerItem({
			id: "item:a",
			input: materials({
				type: "item",
				itemUid: "item:b",
			}),
		});
		const b = createProducerItem({
			id: "item:b",
			input: materials({
				type: "item",
				itemUid: "item:a",
			}),
		});

		expect(
			await cycleDiagnostics({
				[a.uid]: a,
				[b.uid]: b,
			}),
		).toEqual([
			expect.objectContaining({
				cycle: [
					"item:a",
					"item:b",
					"item:a",
				],
				edges: expect.arrayContaining([
					expect.objectContaining({
						ownerItemUid: "item:a",
						acceptedItemUid: "item:b",
					}),
					expect.objectContaining({
						ownerItemUid: "item:b",
						acceptedItemUid: "item:a",
					}),
				]),
			}),
		]);
	});

	it("does not reject a longer cycle without a direct reciprocal pair", async () => {
		const a = createProducerItem({
			id: "item:a",
			input: materials({
				type: "item",
				itemUid: "item:b",
			}),
		});
		const b = createProducerItem({
			id: "item:b",
			input: materials({
				type: "item",
				itemUid: "item:c",
			}),
		});
		const c = createProducerItem({
			id: "item:c",
			input: materials({
				type: "item",
				itemUid: "item:a",
			}),
		});

		expect(
			await cycleDiagnostics({
				[a.uid]: a,
				[b.uid]: b,
				[c.uid]: c,
			}),
		).toEqual([]);
	});

	it("accepts an acyclic material chain", async () => {
		const a = createProducerItem({
			id: "item:a",
			input: materials({
				type: "item",
				itemUid: "item:b",
			}),
		});
		const b = createProducerItem({
			id: "item:b",
			input: materials({
				type: "item",
				itemUid: "item:c",
			}),
		});
		const c = createSimpleItem("item:c");

		expect(
			await cycleDiagnostics({
				[a.uid]: a,
				[b.uid]: b,
				[c.uid]: c,
			}),
		).toEqual([]);
	});

	it("preserves source and input paths for every cycle edge", async () => {
		const a = createProducerItem({
			id: "item:a",
			input: materials({
				type: "item",
				itemUid: "item:b",
			}),
		});
		const b = createProducerItem({
			id: "item:b",
			input: materials({
				type: "item",
				itemUid: "item:a",
			}),
		});
		const result = await Effect.runPromise(
			compileGameSourcesFx([
				createRootSource(),
				GameSourceFileSchema.parse({
					path: "/game/a.json",
					value: {
						items: {
							[a.uid]: a,
						},
					},
				}),
				GameSourceFileSchema.parse({
					path: "/game/b.json",
					value: {
						items: {
							[b.uid]: b,
						},
					},
				}),
			]),
		);
		const diagnostic = result.diagnostics.find(
			({ code }) => code === DiagnosticCodeEnumSchema.enum.InputAcceptanceCycle,
		);

		expect(diagnostic).toMatchObject({
			code: DiagnosticCodeEnumSchema.enum.InputAcceptanceCycle,
			edges: [
				{
					source: "/game/a.json",
					path: [
						"items",
						"item:a",
						"lines",
						0,
						"input",
						0,
						"selector",
					],
				},
				{
					source: "/game/b.json",
				},
			],
		});
	});
});
