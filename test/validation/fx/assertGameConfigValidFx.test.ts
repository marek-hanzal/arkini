import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { compileGameSourcesFx } from "~/v1/compiler/fx/compileGameSourcesFx";
import { DepositItemSchema } from "~/v1/item/schema/DepositItemSchema";
import { assertGameConfigValidFx } from "~/v1/validation/fx/assertGameConfigValidFx";
import {
	createRootSource,
	createSimpleItem,
} from "~test/validation/support/gameValidationTestSource";

describe("assertGameConfigValidFx", () => {
	it("returns a completed config when diagnostics contain only warnings", async () => {
		const deposit = DepositItemSchema.parse({
			...createSimpleItem("item:deposit"),
			type: "deposit",
			count: 1,
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
