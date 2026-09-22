import type { RollSetSchema } from "~/production-output/schema/RollSetSchema";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { compileGameSourcesFx } from "~/game-config-compiler/fx/compileGameSourcesFx";
import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { OutputSchema } from "~/production-output/schema/OutputSchema";
import {
	createOutput,
	createProducerItem,
	createRootSource,
	createSimpleItem,
} from "~test/game-config-validation/support/gameValidationTestSource";
import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticSeverityEnumSchema";

const createFiniteItem = (id: string) =>
	ItemSchema.parse({
		...createSimpleItem(id),

		units: {
			amount: 10,
		},
	});

const diagnostics = async (items: Record<string, unknown>) =>
	(
		await Effect.runPromise(
			compileGameSourcesFx([
				createRootSource({
					items,
				}),
			]),
		)
	).diagnostics.filter(({ code }) => code.startsWith("units:"));

const chanceOutput = (itemId: string, chance: number) =>
	OutputSchema.parse({
		set: [
			{
				rules: [],
				roll: [
					{
						type: "chance",
						chance,
						drop: [
							{
								itemId,
								quantity: {
									min: 1,
									max: 1,
								},
								placement: "drop",
								rules: [],
							},
						],
					},
				],
			},
		],
	});

describe("validateUnitRenewalFn", () => {
	it("warns when a item with units has no configured recreation path", async () => {
		const units = createFiniteItem("item:units");

		expect(
			await diagnostics({
				[units.id]: units,
			}),
		).toEqual([
			expect.objectContaining({
				code: DiagnosticCodeEnumSchema.enum.UnitRenewalMissing,
				severity: DiagnosticSeverityEnumSchema.enum.Warning,
				itemId: units.id,
			}),
		]);
	});

	it("does not count a zero-chance output as recreation", async () => {
		const units = createFiniteItem("item:units");
		const producer = createProducerItem({
			id: "item:producer",
			output: chanceOutput(units.id, 0),
		});

		expect(
			await diagnostics({
				[units.id]: units,
				[producer.id]: producer,
			}),
		).toEqual([
			expect.objectContaining({
				code: DiagnosticCodeEnumSchema.enum.UnitRenewalMissing,
			}),
		]);
	});

	it("requires an unconditional eligible set before claiming guaranteed renewal", async () => {
		const units = createFiniteItem("item:units");
		const output = createOutput([
			{
				itemId: units.id,
			},
		]);
		const conditionalSet: RollSetSchema.Type = {
			...output.set[0],
			rules: [
				{
					type: "enable" as const,
					when: [
						{
							type: "exists" as const,
							query: {
								distance: "universe",
								selector: {
									type: "item" as const,
									itemId: units.id,
								},
							},
						},
					],
				},
			],
		};
		const producer = createProducerItem({
			id: "item:producer",
			output: {
				set: [
					conditionalSet,
				],
			},
		});
		expect(
			await diagnostics({
				[units.id]: units,
				[producer.id]: producer,
			}),
		).toEqual([
			expect.objectContaining({
				code: DiagnosticCodeEnumSchema.enum.UnitRenewalStochastic,
			}),
		]);
		const fallback = createProducerItem({
			id: producer.id,
			output: {
				set: [
					conditionalSet,
					output.set[0],
				],
			},
		});
		expect(
			await diagnostics({
				[units.id]: units,
				[fallback.id]: fallback,
			}),
		).toEqual([]);
	});

	it("warns when recreation is only stochastic", async () => {
		const units = createFiniteItem("item:units");
		const producer = createProducerItem({
			id: "item:producer",
			output: chanceOutput(units.id, 0.5),
		});

		expect(
			await diagnostics({
				[units.id]: units,
				[producer.id]: producer,
			}),
		).toEqual([
			expect.objectContaining({
				code: DiagnosticCodeEnumSchema.enum.UnitRenewalStochastic,
			}),
		]);
	});

	it("accepts a guaranteed recreation path and suppresses weaker warnings", async () => {
		const units = createFiniteItem("item:units");
		const guaranteed = createProducerItem({
			id: "item:guaranteed",
			output: createOutput([
				{
					itemId: units.id,
				},
			]),
		});
		const stochastic = createProducerItem({
			id: "item:stochastic",
			output: chanceOutput(units.id, 0.5),
		});

		expect(
			await diagnostics({
				[units.id]: units,
				[guaranteed.id]: guaranteed,
				[stochastic.id]: stochastic,
			}),
		).toEqual([]);
	});
});
