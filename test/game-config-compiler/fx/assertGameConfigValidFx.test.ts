import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { compileGameSourcesFx } from "~/game-config-compiler/fx/compileGameSourcesFx";
import { DepositSchema } from "~/item-definition/schema/DepositSchema";
import { assertGameConfigValidFx } from "~/game-config-compiler/fx/assertGameConfigValidFx";
import {
	createRootSource,
	createSimpleItem,
} from "~test/game-config-validation/support/gameValidationTestSource";
import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";
import { DiagnosticSeverityEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticSeverityEnumSchema";

describe("assertGameConfigValidFx", () => {
	it("returns a completed config when diagnostics contain only warnings", async () => {
		const deposit = DepositSchema.parse({
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
