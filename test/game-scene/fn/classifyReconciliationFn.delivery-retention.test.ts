import { describe, expect, it } from "vitest";

import { classifyActorUpdateFn } from "~/game-scene/fn/classifyActorUpdateFn";
import { classifyReconciliationFn } from "~/game-scene/fn/classifyReconciliationFn";

import {
	boardLocation,
	createDeliveryActor,
	createDeliveryActorItem,
} from "./classifyReconciliationFn.delivery-retention.test/fixture";

const emptyReconciliationFacts = {
	feedbackCues: [],
	hiddenActorIds: new Set<string>(),
	inventoryActorIds: new Set<string>(),
	motionRetainedActorIds: new Set<string>(),
	pendingActorIds: new Set<string>(),
	visibleActors: new Map(),
};

describe("main delivery retention", () => {
	it("updates canonical visuals without stealing or prematurely releasing delivery pose", () => {
		const current = createDeliveryActorItem("runtime:delivery");
		const displayItem = createDeliveryActorItem(current.id, {
			location: boardLocation(1),
			revision: "revision:delivery:next",
		});
		const update = classifyActorUpdateFn({
			actor: createDeliveryActor(current),
			deliveryRetained: true,
			directLanding: false,
			displayItem,
			motionClaimed: false,
			pose: {
				layer: null as never,
				size: 100,
				x: 140,
				y: 60,
			},
			poseChannelActive: false,
			preserveVisual: false,
		});

		expect(update.item).toEqual({
			kind: "visual",
			preserveVisual: false,
			size: 80,
		});
		expect(update.pose).toEqual({
			kind: "owned",
		});

		const retained = classifyReconciliationFn({
			...emptyReconciliationFacts,
			actorIds: [
				current.id,
			],
			deliveryRetainedActorIds: new Set([
				current.id,
			]),
		});
		expect(retained.departures).toEqual([]);

		const released = classifyReconciliationFn({
			...emptyReconciliationFacts,
			actorIds: [
				current.id,
			],
			deliveryRetainedActorIds: new Set(),
		});
		expect(released.departures).toEqual([
			{
				actorId: current.id,
				feedbackCues: [],
				kind: "release",
				style: "default",
			},
		]);
	});
});
