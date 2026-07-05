import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { planActivationInputRefsFx } from "~/activation/planActivationInputRefsFx";
import { createEngineTestConfig } from "~/engine/test/createEngineTestConfig";
import { runInitialSave } from "~/engine/applyGameActionFx.testSupport";

const runFx = <A, E>(effect: Effect.Effect<A, E, never>) => Effect.runSync(effect);

describe("planActivationInputRefsFx", () => {
	it("plans a partial board stack input before inventory fallback", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.board.items["item-instance:2"] = {
			id: "item-instance:2",
			itemId: "item:twig",
			quantity: 3,
			x: 1,
			y: 0,
		};

		const result = runFx(
			planActivationInputRefsFx({
				inputs: [
					{
						itemId: "item:twig",
						quantity: 2,
					},
				],
				save,
				storedInputQuantities: {},
			}),
		);

		expect(result).toEqual([
			{
				itemInstanceId: "item-instance:2",
				kind: "board",
				quantity: 2,
			},
		]);
	});

	it("skips non-consumable board candidates and continues with inventory", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.board.items["item-instance:2"] = {
			id: "item-instance:2",
			itemId: "item:twig",
			x: 1,
			y: 0,
		};
		save.producerInputs["item-instance:2"] = {
			lineInputs: {},
		};
		save.inventory.slots[0] = {
			itemId: "item:twig",
			quantity: 1,
		};

		const result = runFx(
			planActivationInputRefsFx({
				inputs: [
					{
						itemId: "item:twig",
						quantity: 1,
					},
				],
				save,
				storedInputQuantities: {},
			}),
		);

		expect(result).toEqual([
			{
				kind: "inventory",
				quantity: 1,
				slotIndex: 0,
			},
		]);
	});
});
