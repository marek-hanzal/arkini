import { describe, expect, it } from "vitest";
import { createEngineTestConfig } from "~/engine/test/createEngineTestConfig";
import { runActionEither, runInitialSave } from "~/engine/applyGameActionFx.testSupport";

describe("output-owned producer effect runtime guards", () => {
	it("rejects producer starts through output-owned grant requirements", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			itemEffects: {
				"item:empty-stash": [
					{
						id: "effect:test:missing",
						polarity: "neutral",
						grants: [
							{
								id: "grant:test:missing",
								name: "Missing",
							},
						],
						name: "Missing Grant",
					},
				],
			},
			lineOverrides: {
				"line:test": {
					...baseConfig.lineCatalog["line:test"],
					output: [
						{
							itemId: "item:twig",
							quantity: 2,
							type: "guaranteed",
							effects: [
								{
									display: "always",
									kind: "grant.require",
									phase: "start",
									selector: {
										allOf: [
											{
												ids: [
													"grant:test:missing",
												],
											},
										],
									},
								},
							],
						},
					],
				},
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runActionEither({
			action: {
				inputRefs: [],
				itemInstanceId: "item-instance:1",
				lineId: "line:test",
				type: "line.start",
			},
			config,
			nowMs: 0,
			save,
		});

		expect(result._tag).toBe("Left");
		expect(result).toMatchObject({
			left: {
				reason: "effect:disabled-output",
			},
		});
	});
});
