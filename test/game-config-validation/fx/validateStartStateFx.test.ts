import { Effect } from "effect";
import { describe, expect, it } from "vitest";

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
		const config = {
			...startTestConfig,
			templates: [
				{
					uid: "invalid",
					title: "Invalid",
					width: 2,
					height: 2,
					board: [
						{
							itemId: "tree",
							x: 0,
							y: 0,
						},
						{
							itemId: "tree",
							x: 0,
							y: 0,
						},
					],
				},
			],
			start: {
				currentSpace: 0,
				spaces: [
					{
						space: 0,
						templateUid: "invalid",
					},
				],
			},
		};
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
