import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { compileGameSourcesFx } from "~/engine/compiler/fx/compileGameSourcesFx";
import { DepositItemSchema } from "~/engine/item/schema/DepositItemSchema";
import { assertGameConfigValidFx } from "~/engine/validation/fx/assertGameConfigValidFx";
import {
	createRootSource,
	createSimpleItem,
} from "~test/validation/support/gameValidationTestSource";
import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/engine/validation/schema/DiagnosticSeverityEnumSchema";

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
					code: DiagnosticCodeEnumSchema.enum.DepositUnsustainable,
					severity: DiagnosticSeverityEnumSchema.enum.Warning,
				}),
			]),
		);
		expect(config.items[deposit.id]).toEqual(deposit);
	});
});
