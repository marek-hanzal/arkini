import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { validateStartStateFx } from "~/game-config-validation/fx/validateStartStateFx";
import { startTestConfig } from "~test/game-start/support/startTestConfig";
import { DiagnosticCodeEnumSchema } from "~/game-config-diagnostic/schema/DiagnosticCodeEnumSchema";

const provenance = {
	start: "start.json",
	items: {},
};

describe("validateStartStateFx", () => {
	it("accepts a start state that the runtime builder can materialize", () => {
		const diagnostics = Effect.runSync(
			validateStartStateFx({
				config: startTestConfig,
				provenance,
			}),
		);

		expect(diagnostics).toEqual([]);
	});

	it("rejects conflicting board locations", () => {
		const config = GameConfigSchema.parse({
			...startTestConfig,
			start: {
				currentSpace: 0,
				board: [
					{
						space: 0,
						itemId: "tree",
						x: 0,
						y: 0,
					},
					{
						space: 0,
						itemId: "tree",
						x: 0,
						y: 0,
					},
				],
			},
		});
		const diagnostics = Effect.runSync(
			validateStartStateFx({
				config,
				provenance,
			}),
		);

		expect(diagnostics).toEqual([
			expect.objectContaining({
				code: DiagnosticCodeEnumSchema.enum.StartInvalid,
				failureTag: "RuntimeInvalidError",
				path: [
					"start",
				],
				source: "start.json",
			}),
		]);
	});
});
