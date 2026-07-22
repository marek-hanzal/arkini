import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { compileGameSourcesFx } from "~/engine/compiler/fx/compileGameSourcesFx";
import { DepositItemSchema } from "~/engine/item/schema/DepositItemSchema";
import { OutputSchema } from "~/engine/output/schema/OutputSchema";
import {
	createOutput,
	createProducerItem,
	createRootSource,
	createSimpleItem,
} from "~test/validation/support/gameValidationTestSource";
import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";

const createDeposit = (id: string) =>
	DepositItemSchema.parse({
		...createSimpleItem(id),
		type: "deposit",
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
	).diagnostics.filter(({ code }) => code.startsWith("deposit:"));

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
									type: "value",
									value: 1,
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

describe("validateLimitedDepositsFx", () => {
	it("warns when a finite deposit has no configured recreation path", async () => {
		const deposit = createDeposit("item:deposit");

		expect(
			await diagnostics({
				[deposit.id]: deposit,
			}),
		).toEqual([
			expect.objectContaining({
				code: DiagnosticCodeEnumSchema.enum.DepositUnsustainable,
				severity: DiagnosticSeverityEnumSchema.enum.Warning,
				itemId: deposit.id,
			}),
		]);
	});

	it("does not count a zero-chance output as recreation", async () => {
		const deposit = createDeposit("item:deposit");
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
				code: DiagnosticCodeEnumSchema.enum.DepositUnsustainable,
			}),
		]);
	});

	it("warns when recreation is only stochastic", async () => {
		const deposit = createDeposit("item:deposit");
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
				code: DiagnosticCodeEnumSchema.enum.DepositStochasticSoftlock,
			}),
		]);
	});

	it("accepts a guaranteed recreation path and suppresses weaker warnings", async () => {
		const deposit = createDeposit("item:deposit");
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
