// @vitest-environment jsdom

import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { GameTransition } from "~/renderer/game/session/GameSession";
import {
	flushAfterRender,
	flushMicrotasks,
	inventoryItem,
	mountScene,
	inventorySceneProbe as sceneState,
} from "./createInventoryRuntimeFx.test/fixture";

const spaceTransition = {
	events: [
		{
			type: "item:charge-spent",
			itemId: inventoryItem.id,
			canonicalItemId: inventoryItem.itemId,
			location: inventoryItem.location,
			previousCharges: 2,
			resultingCharges: 1,
		},
		{
			type: "current-space:changed",
			previousSpace: 0,
			currentSpace: 2,
		},
	],
	previousRuntime: {
		currentSpace: 0,
	} as never,
	runtime: {
		currentSpace: 2,
	} as never,
	sequence: 1,
} as GameTransition;

describe("Inventory runtime / Space presentation", () => {
	it("acknowledges a committed Space action only after its accounting frame is projected", async () => {
		const { actor, runtime } = await mountScene();
		sceneState.items = [
			{
				...inventoryItem,
				quantity: 3,
				revision: "revision:water:accounted",
			},
		];
		let acknowledged = false;

		const projection = Effect.runPromise(
			runtime.projectSpaceActivationFx(spaceTransition),
		).then(() => {
			acknowledged = true;
		});
		await flushMicrotasks();

		expect(actor.item).toMatchObject({
			quantity: 3,
			revision: "revision:water:accounted",
		});
		expect(acknowledged).toBe(false);

		flushAfterRender();
		await projection;
		expect(acknowledged).toBe(true);
		await Effect.runPromise(runtime.closeFx);
	});

	it("settles a pending projection without presenting the switch after scene teardown", async () => {
		const { runtime } = await mountScene();
		const projection = Effect.runPromise(runtime.projectSpaceActivationFx(spaceTransition));
		await flushMicrotasks();

		await Effect.runPromise(runtime.closeFx);
		await projection;

		expect(sceneState.afterRenderWork).toHaveLength(0);
	});
});
