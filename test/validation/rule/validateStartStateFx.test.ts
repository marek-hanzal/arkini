import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import { validateStartStateFx } from "~/engine/validation/rule/validateStartStateFx";
import { startTestConfig } from "~test/start/fx/support/startTestConfig";
import { DiagnosticCodeEnumSchema } from "~/engine/validation/schema/DiagnosticCodeEnumSchema";

const provenance = {
	start: "start.json",
	categories: {},
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
				inventory: [],
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

	it("rejects unavailable inventory capacity", () => {
		const config = GameConfigSchema.parse({
			...startTestConfig,
			meta: {
				...startTestConfig.meta,
				inventory: {
					width: 1,
					height: 1,
				},
			},
		});
		const diagnostics = Effect.runSync(
			validateStartStateFx({
				config,
				provenance,
			}),
		);

		expect(diagnostics[0]).toMatchObject({
			code: DiagnosticCodeEnumSchema.enum.StartInvalid,
			failureTag: "StartInventoryUnavailableError",
		});
	});
});
