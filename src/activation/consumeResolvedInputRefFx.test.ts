import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { consumeResolvedInputRefFx } from "~/activation/consumeResolvedInputRefFx";
import { resolveInputRefsFx } from "~/activation/resolveInputRefsFx";
import { createEngineTestConfig } from "~/engine/test/createEngineTestConfig";
import { runInitialSave } from "~/engine/applyGameActionFx.testSupport";
import type { GameEvent } from "~/event/GameEventSchema";

const runFx = <A, E>(effect: Effect.Effect<A, E, never>) => Effect.runSync(effect);
const runFxEither = <A, E>(effect: Effect.Effect<A, E, never>) =>
	Effect.runSync(Effect.either(effect));

describe("consumeResolvedInputRefFx", () => {
	it("removes board runtime state when a board input is consumed", () => {
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
			lineInputs: {
				"line:shred": {
					items: {
						"item:twig": 1,
					},
				},
			},
		};
		const events: GameEvent[] = [];

		runFx(
			consumeResolvedInputRefFx({
				events,
				nextSave: save,
				reason: "line-input",
				ref: {
					itemId: "item:twig",
					itemInstanceId: "item-instance:2",
					kind: "board",
					quantity: 1,
				},
			}),
		);

		expect(save.board.items["item-instance:2"]).toBeUndefined();
		expect(save.producerInputs["item-instance:2"]).toBeUndefined();
		expect(events).toMatchObject([
			{
				from: {
					itemInstanceId: "item-instance:2",
					kind: "board",
				},
				itemId: "item:twig",
				reason: "line-input",
				type: "item.consumed",
			},
		]);
	});

	it("preserves inventory stack creation time when only part of a passive stack is consumed", () => {
		const config = createEngineTestConfig();
		const save = runInitialSave({
			config,
			nowMs: 0,
		});
		save.inventory.slots[0] = {
			createdAtMs: 123,
			itemId: "item:twig",
			quantity: 3,
		};
		const events: GameEvent[] = [];

		runFx(
			consumeResolvedInputRefFx({
				events,
				nextSave: save,
				reason: "line-input",
				ref: {
					itemId: "item:twig",
					kind: "inventory",
					quantity: 1,
					slotIndex: 0,
				},
			}),
		);

		expect(save.inventory.slots[0]).toEqual({
			createdAtMs: 123,
			itemId: "item:twig",
			quantity: 2,
		});
	});
});

describe("resolveInputRefsFx", () => {
	it("rejects board inputs with preservable runtime state", () => {
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

		const result = runFxEither(
			resolveInputRefsFx({
				inputRefs: [
					{
						itemInstanceId: "item-instance:2",
						kind: "board",
					},
				],
				save,
			}),
		);

		expect(result).toMatchObject({
			_tag: "Left",
			left: {
				_tag: "GameActionRejected",
				reason: "item_busy",
			},
		});
	});
});
