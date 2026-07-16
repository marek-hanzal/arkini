import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { compileGameSourcesFx } from "~/engine/compiler/fx/compileGameSourcesFx";
import { DepositItemSchema } from "~/engine/item/schema/DepositItemSchema";
import { assertGameConfigValidFx } from "~/engine/validation/fx/assertGameConfigValidFx";
import {
	createRootSource,
	createSimpleItem,
} from "~test/validation/support/gameValidationTestSource";

describe("assertGameConfigValidFx", () => {
	it("returns a completed config when diagnostics contain only warnings", async () => {
		const deposit = DepositItemSchema.parse({
			...createSimpleItem("item:deposit"),
			type: "deposit",
			charges: {
				amount: 1,
			},
		});
		const compilation = await Effect.runPromise(
			compileGameSourcesFx([
				createRootSource({
					items: {
						[deposit.id]: deposit,
					},
				}),
			]),
		);
		const config = await Effect.runPromise(assertGameConfigValidFx(compilation));

		expect(compilation.diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "deposit:unsustainable",
					severity: "warning",
				}),
			]),
		);
		expect(config.items[deposit.id]).toEqual(deposit);
	});
});
