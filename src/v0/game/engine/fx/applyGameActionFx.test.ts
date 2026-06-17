import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { applyGameActionFx } from "~/v0/game/engine/fx/applyGameActionFx";
import { createInitialGameSave } from "~/v0/game/engine/logic/createInitialGameSave";
import { createEngineTestConfig } from "~/v0/game/engine/logic/testGameConfig";

const runAction = (props: applyGameActionFx.Props) => Effect.runSync(applyGameActionFx(props));
const runActionEither = (props: applyGameActionFx.Props) =>
	Effect.runSync(Effect.either(applyGameActionFx(props)));

describe("applyGameActionFx", () => {
	it("starts a no-input producer product as an Effect action", () => {
		const config = createEngineTestConfig();
		const save = createInitialGameSave({
			config,
			nowMs: 0,
		});

		const result = runAction({
			action: {
				inputRefs: [],
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				type: "producer.product.start",
			},
			config,
			nowMs: 500,
			save,
		});

		expect(result.save.producerJobs).toEqual({
			"job:1": {
				completesAtMs: 1500,
				id: "job:1",
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				startedAtMs: 500,
			},
		});
		expect(result.events).toEqual([
			{
				completesAtMs: 1500,
				jobId: "job:1",
				producerItemInstanceId: "item-instance:1",
				productId: "product:test",
				startedAtMs: 500,
				type: "product.started",
			},
		]);
		expect(result.nextWakeAtMs).toBe(1500);
	});

	it("consumes explicit inventory inputs at product start", () => {
		const config = createEngineTestConfig();
		const save = createInitialGameSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 2,
		};

		const result = runAction({
			action: {
				inputRefs: [
					{
						kind: "inventory",
						quantity: 1,
						slotIndex: 0,
					},
				],
				producerItemInstanceId: "item-instance:1",
				productId: "product:shred",
				type: "producer.product.start",
			},
			config,
			nowMs: 100,
			save,
		});

		expect(result.save.inventory.slots[0]).toEqual({
			itemId: "item:twig",
			quantity: 1,
		});
		expect(result.events).toMatchObject([
			{
				from: {
					kind: "inventory",
					nextQuantity: 1,
					previousQuantity: 2,
					quantity: 1,
					slotIndex: 0,
				},
				itemId: "item:twig",
				reason: "product-input",
				type: "item.consumed",
			},
			{
				productId: "product:shred",
				type: "product.started",
			},
		]);
	});

	it("accepts passive requirements from inventory", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					requirements: [
						{
							itemId: "item:twig",
							quantity: 1,
							scope: "board_or_inventory",
							type: "passive",
						},
					],
				},
			},
		});
		const save = createInitialGameSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 1,
		};

		const result = runAction({
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

		expect(result.events).toMatchObject([
			{
				type: "product.started",
			},
		]);
	});

	it("fails through the typed error channel when a passive requirement is missing", () => {
		const baseConfig = createEngineTestConfig();
		const config = createEngineTestConfig({
			products: {
				...baseConfig.products,
				"product:test": {
					...baseConfig.products["product:test"],
					requirements: [
						{
							itemId: "item:twig",
							quantity: 1,
							scope: "inventory",
							type: "passive",
						},
					],
				},
			},
		});
		const save = createInitialGameSave({
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
		if (result._tag === "Left") {
			expect(result.left).toMatchObject({
				_tag: "GameActionRejected",
				reason: "missing_requirement",
			});
		}
	});
});
