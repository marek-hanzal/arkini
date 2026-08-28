import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { classifyPixiMainSceneActorUpdateFx } from "~/ui/pixi/scene/classifyPixiMainSceneActorUpdateFx";
import { classifyPixiMainSceneReconciliationFx } from "~/ui/pixi/scene/classifyPixiMainSceneReconciliationFx";

import {
	boardLocation,
	createDeliveryActor,
	createDeliveryItem,
} from "./classifyPixiMainSceneDeliveryRetentionFx.test/fixture";

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
		const current = createDeliveryItem("runtime:delivery");
		const displayItem = createDeliveryItem(current.id, {
			location: boardLocation(1),
			revision: "revision:delivery:next",
		});
		const update = Effect.runSync(
			classifyPixiMainSceneActorUpdateFx({
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
			classifyPixiMainSceneReconciliationFx({
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
			classifyPixiMainSceneReconciliationFx({
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
