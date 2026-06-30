import { describe, expect, it } from "vitest";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { runActionEither, runInitialSave } from "~/v0/game/engine/applyGameActionFx.testSupport";

describe("line-owned effect runtime guards", () => {
	it("rejects producer starts through line-owned grant requirements", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			effects: {
				"effect:test:missing": {
					polarity: "neutral",
					grantIds: [
						"grant:test:missing",
					],
					name: "Missing Grant",
				},
			},
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
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
			},
		});
		const save = runInitialSave({
			config,
			nowMs: 0,
		});

		const result = runActionEither({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product.start",
			},
			config,
			nowMs: 0,
			save,
		});

		expect(result._tag).toBe("Left");
		expect(result).toMatchObject({
			left: {
				reason: "effect:missing-grant",
			},
		});
	});
});
