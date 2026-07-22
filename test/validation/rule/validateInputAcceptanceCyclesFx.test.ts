import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { compileGameSourcesFx } from "~/engine/compiler/fx/compileGameSourcesFx";
import { GameSourceFileSchema } from "~/engine/source/schema/GameSourceFileSchema";
import type { SelectorSchema } from "~/engine/selector/schema/SelectorSchema";
import {
	createProducerItem,
	createRootSource,
	createSimpleItem,
} from "~test/validation/support/gameValidationTestSource";
import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";

const materials = (selector: SelectorSchema.Type) => [
	{
		type: "materials" as const,
		selector,
		quantity: {
			type: "value" as const,
			value: 1,
		},
		capacity: 0,
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
	(await compileItems(items)).diagnostics.filter(({ code }) => code === DiagnosticCodeEnumSchema.enum.InputAcceptanceCycle);

describe("validateInputAcceptanceCyclesFx", () => {
	it("rejects a material input self-loop", async () => {
		const item = createProducerItem({
			id: "item:a",
			input: materials({
				type: "item",
				itemId: "item:a",
			}),
		});

		expect(
			await cycleDiagnostics({
				[item.id]: item,
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
				itemId: "item:b",
			}),
		});
		const b = createProducerItem({
			id: "item:b",
			input: materials({
				type: "item",
				itemId: "item:a",
			}),
		});

		expect(
			await cycleDiagnostics({
				[a.id]: a,
				[b.id]: b,
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
						ownerItemId: "item:a",
						acceptedItemId: "item:b",
					}),
					expect.objectContaining({
						ownerItemId: "item:b",
						acceptedItemId: "item:a",
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
				itemId: "item:b",
			}),
		});
		const b = createProducerItem({
			id: "item:b",
			input: materials({
				type: "item",
				itemId: "item:c",
			}),
		});
		const c = createProducerItem({
			id: "item:c",
			input: materials({
				type: "item",
				itemId: "item:a",
			}),
		});

		expect(
			await cycleDiagnostics({
				[a.id]: a,
				[b.id]: b,
				[c.id]: c,
			}),
		).toEqual([]);
	});

	it("accepts an acyclic material chain", async () => {
		const a = createProducerItem({
			id: "item:a",
			input: materials({
				type: "item",
				itemId: "item:b",
			}),
		});
		const b = createProducerItem({
			id: "item:b",
			input: materials({
				type: "item",
				itemId: "item:c",
			}),
		});
		const c = createSimpleItem("item:c");

		expect(
			await cycleDiagnostics({
				[a.id]: a,
				[b.id]: b,
				[c.id]: c,
			}),
		).toEqual([]);
	});

	it("detects a cycle introduced through expanded tag selectors", async () => {
		const a = {
			...createProducerItem({
				id: "item:a",
				input: materials({
					type: "tag",
					tag: "tag:b",
				}),
			}),
			tags: [
				"tag:a",
			],
		};
		const b = {
			...createProducerItem({
				id: "item:b",
				input: materials({
					type: "tag",
					tag: "tag:a",
				}),
			}),
			tags: [
				"tag:b",
			],
		};

		expect(
			await cycleDiagnostics({
				[a.id]: a,
				[b.id]: b,
			}),
		).toHaveLength(1);
	});

	it("preserves source and input paths for every cycle edge", async () => {
		const a = createProducerItem({
			id: "item:a",
			input: materials({
				type: "item",
				itemId: "item:b",
			}),
		});
		const b = createProducerItem({
			id: "item:b",
			input: materials({
				type: "item",
				itemId: "item:a",
			}),
		});
		const result = await Effect.runPromise(
			compileGameSourcesFx([
				createRootSource(),
				GameSourceFileSchema.parse({
					path: "/game/a.json",
					value: {
						items: {
							[a.id]: a,
						},
					},
				}),
				GameSourceFileSchema.parse({
					path: "/game/b.json",
					value: {
						items: {
							[b.id]: b,
						},
					},
				}),
			]),
		);
		const diagnostic = result.diagnostics.find(({ code }) => code === DiagnosticCodeEnumSchema.enum.InputAcceptanceCycle);

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
