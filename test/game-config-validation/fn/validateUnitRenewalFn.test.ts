import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { compileGameSourcesFx } from "~/game-config-compiler/fx/compileGameSourcesFx";
import { CommonSchema } from "~/item-definition/schema/CommonSchema";
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
	CommonSchema.parse({
		...createSimpleItem(id),
		type: "common",
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
