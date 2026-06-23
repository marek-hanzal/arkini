import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { consumeResolvedInputRefFx } from "~/v0/game/requirements/consumeResolvedInputRefFx";
import { resolveInputRefsFx } from "~/v0/game/requirements/resolveInputRefsFx";
import { createEngineTestConfig } from "~/v0/game/engine/test/createEngineTestConfig";
import { runInitialSave } from "~/v0/game/engine/applyGameActionFx.testSupport";
import type { GameEvent } from "~/v0/game/event/GameEventSchema";

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
			productInputs: {
				"product:shred": {
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
				reason: "product-input",
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
				reason: "product-input",
				type: "item.consumed",
			},
		]);
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
			productInputs: {},
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
