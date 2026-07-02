import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { planActivationInputRefsFx } from "~/v0/game/activation/planActivationInputRefsFx";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { runInitialSave } from "~/v0/game/engine/applyGameActionFx.testSupport";

const runFx = <A, E>(effect: Effect.Effect<A, E, never>) => Effect.runSync(effect);

describe("planActivationInputRefsFx", () => {
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
