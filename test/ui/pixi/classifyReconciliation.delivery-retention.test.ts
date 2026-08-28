import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { classifyActorUpdateFx } from "~/ui/pixi/scene/classifyActorUpdateFx";
import { classifyReconciliationFx } from "~/ui/pixi/scene/classifyReconciliationFx";

import {
	boardLocation,
	createDeliveryActor,
	createDeliveryActorItem,
} from "./classifyReconciliation.delivery-retention.test/fixture";

const emptyReconciliationFacts = {
	feedbackCues: [],
	hiddenActorIds: new Set<string>(),
	inventoryActorIds: new Set<string>(),
	motionRetainedActorIds: new Set<string>(),
	pendingActorIds: new Set<string>(),
	visibleActors: new Map(),
};

describe("Pixi main-scene delivery retention", () => {
	it("updates canonical visuals without stealing or prematurely releasing delivery pose", () => {
		const current = createDeliveryActorItem("runtime:delivery");
		const displayItem = createDeliveryActorItem(current.id, {
			location: boardLocation(1),
			revision: "revision:delivery:next",
		});
		const update = Effect.runSync(
			classifyActorUpdateFx({
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
			}),
		);

		expect(update.item).toEqual({
			kind: "visual",
			preserveVisual: false,
			size: 80,
		});
		expect(update.pose).toEqual({
			kind: "owned",
		});

		const retained = Effect.runSync(
			classifyReconciliationFx({
				...emptyReconciliationFacts,
				actorIds: [
					current.id,
				],
				deliveryRetainedActorIds: new Set([
					current.id,
				]),
			}),
		);
		expect(retained.departures).toEqual([]);

		const released = Effect.runSync(
			classifyReconciliationFx({
				...emptyReconciliationFacts,
				actorIds: [
					current.id,
				],
				deliveryRetainedActorIds: new Set(),
			}),
		);
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
