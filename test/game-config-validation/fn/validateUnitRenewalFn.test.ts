import type { RollSetSchema } from "~/outcome/schema/RollSetSchema";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { compileGameSourcesFx } from "~/game-config-compiler/fx/compileGameSourcesFx";
import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";
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

const chanceOutput = (itemUid: string, chance: number) =>
	OutcomeTableSchema.parse({
		set: [
			{
				rules: [],
				roll: [
					{
						type: "chance",
						chance,
						outcome: [
							{
								type: "item",
								itemUid,
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
				[units.uid]: units,
			}),
		).toEqual([
			expect.objectContaining({
				code: DiagnosticCodeEnumSchema.enum.UnitRenewalMissing,
				severity: DiagnosticSeverityEnumSchema.enum.Warning,
				itemUid: units.uid,
			}),
		]);
	});

	it("does not count a zero-chance output as recreation", async () => {
		const units = createFiniteItem("item:units");
		const producer = createProducerItem({
			id: "item:producer",
			outcome: chanceOutput(units.uid, 0),
		});

		expect(
			await diagnostics({
				[units.uid]: units,
				[producer.uid]: producer,
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
				itemUid: units.uid,
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
								distance: "far",
								selector: {
									type: "item" as const,
									itemUid: units.uid,
								},
							},
						},
					],
				},
			],
		};
		const producer = createProducerItem({
			id: "item:producer",
			outcome: {
				set: [
					conditionalSet,
				],
			},
		});
		expect(
			await diagnostics({
				[units.uid]: units,
				[producer.uid]: producer,
			}),
		).toEqual([
			expect.objectContaining({
				code: DiagnosticCodeEnumSchema.enum.UnitRenewalStochastic,
			}),
		]);
		const fallback = createProducerItem({
			id: producer.uid,
			outcome: {
				set: [
					conditionalSet,
					output.set[0],
				],
			},
		});
		expect(
			await diagnostics({
				[units.uid]: units,
				[fallback.uid]: fallback,
			}),
		).toEqual([]);
	});

	it("warns when recreation is only stochastic", async () => {
		const units = createFiniteItem("item:units");
		const producer = createProducerItem({
			id: "item:producer",
			outcome: chanceOutput(units.uid, 0.5),
		});

		expect(
			await diagnostics({
				[units.uid]: units,
				[producer.uid]: producer,
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
			outcome: createOutput([
				{
					itemUid: units.uid,
				},
			]),
		});
		const stochastic = createProducerItem({
			id: "item:stochastic",
			outcome: chanceOutput(units.uid, 0.5),
		});

		expect(
			await diagnostics({
				[units.uid]: units,
				[guaranteed.uid]: guaranteed,
				[stochastic.uid]: stochastic,
			}),
		).toEqual([]);
	});
});
