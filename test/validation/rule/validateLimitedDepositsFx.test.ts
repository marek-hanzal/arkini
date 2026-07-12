import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { compileGameSourcesFx } from "~/v1/compiler/fx/compileGameSourcesFx";
import { DepositItemSchema } from "~/v1/item/schema/DepositItemSchema";
import {
	createOutput,
	createProducerItem,
	createRootSource,
	createSimpleItem,
} from "~test/validation/support/gameValidationTestSource";

const createDeposit = (id: string) =>
	DepositItemSchema.parse({
		...createSimpleItem(id),
		type: "deposit",
		count: 10,
	});

const warnings = async (items: Record<string, unknown>) =>
	(
		await Effect.runPromise(
			compileGameSourcesFx([
				createRootSource({
					items,
				}),
			]),
		)
	).diagnostics.filter(({ code }) => code === "deposit:unsustainable");

describe("validateLimitedDepositsFx", () => {
	it("warns when a finite deposit has no configured recreation path", async () => {
		const deposit = createDeposit("item:deposit");

		expect(
			await warnings({
				[deposit.id]: deposit,
			}),
		).toEqual([
			expect.objectContaining({
				severity: "warning",
				itemId: deposit.id,
			}),
		]);
	});

	it("accepts a deposit emitted by another configured output", async () => {
		const deposit = createDeposit("item:deposit");
		const producer = createProducerItem({
			id: "item:producer",
			output: createOutput([
				{
					itemId: deposit.id,
				},
			]),
		});

		expect(
			await warnings({
				[deposit.id]: deposit,
				[producer.id]: producer,
			}),
		).toEqual([]);
	});
});
