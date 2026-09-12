import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { compileGameSourcesFx } from "~/game-config-compiler/fx/compileGameSourcesFx";
import { SimpleSchema } from "~/item-definition/schema/SimpleSchema";
import { OutputSchema } from "~/production-output/schema/OutputSchema";
import {
	createOutput,
	createProducerItem,
	createRootSource,
	createSimpleItem,
} from "~test/game-config-validation/support/gameValidationTestSource";
import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticSeverityEnumSchema";

const createChargedItem = (id: string) =>
	SimpleSchema.parse({
		...createSimpleItem(id),
		type: "simple",
		charges: {
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
	).diagnostics.filter(({ code }) => code.startsWith("charges:"));

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

describe("validateChargeRenewalFn", () => {
	it("warns when a charged item has no configured recreation path", async () => {
		const deposit = createChargedItem("item:deposit");

		expect(
			await diagnostics({
				[deposit.id]: deposit,
			}),
		).toEqual([
			expect.objectContaining({
				code: DiagnosticCodeEnumSchema.enum.ChargeRenewalMissing,
				severity: DiagnosticSeverityEnumSchema.enum.Warning,
				itemId: deposit.id,
			}),
		]);
	});

	it("does not count a zero-chance output as recreation", async () => {
		const deposit = createChargedItem("item:deposit");
		const producer = createProducerItem({
			id: "item:producer",
			output: chanceOutput(deposit.id, 0),
		});

		expect(
			await diagnostics({
				[deposit.id]: deposit,
				[producer.id]: producer,
			}),
		).toEqual([
			expect.objectContaining({
				code: DiagnosticCodeEnumSchema.enum.ChargeRenewalMissing,
			}),
		]);
	});

	it("warns when recreation is only stochastic", async () => {
		const deposit = createChargedItem("item:deposit");
		const producer = createProducerItem({
			id: "item:producer",
			output: chanceOutput(deposit.id, 0.5),
		});

		expect(
			await diagnostics({
				[deposit.id]: deposit,
				[producer.id]: producer,
			}),
		).toEqual([
			expect.objectContaining({
				code: DiagnosticCodeEnumSchema.enum.ChargeRenewalStochastic,
			}),
		]);
	});

	it("accepts a guaranteed recreation path and suppresses weaker warnings", async () => {
		const deposit = createChargedItem("item:deposit");
		const guaranteed = createProducerItem({
			id: "item:guaranteed",
			output: createOutput([
				{
					itemId: deposit.id,
				},
			]),
		});
		const stochastic = createProducerItem({
			id: "item:stochastic",
			output: chanceOutput(deposit.id, 0.5),
		});

		expect(
			await diagnostics({
				[deposit.id]: deposit,
				[guaranteed.id]: guaranteed,
				[stochastic.id]: stochastic,
			}),
		).toEqual([]);
	});
});
