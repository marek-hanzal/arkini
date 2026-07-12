import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import { validateStartStateFx } from "~/v1/validation/rule/validateStartStateFx";
import { startTestConfig } from "~test/start/fx/support/startTestConfig";

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
				code: "start:invalid",
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
			code: "start:invalid",
			failureTag: "StartInventoryUnavailableError",
		});
	});
});
