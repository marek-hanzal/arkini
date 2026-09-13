import { describe, expect, it } from "vitest";

import { classifyActorUpdateFn } from "~/game-scene/fn/classifyActorUpdateFn";
import {
	createDeliveryActor,
	createDeliveryActorItem,
} from "./classifyReconciliationFn.delivery-retention.test/fixture";

describe("Clock overlay reconciliation", () => {
	it("updates pulse phase, pause and removal without replacing artwork or changing job progress", () => {
		const current = createDeliveryActorItem("runtime:clock", {
			progressRatio: 0.5,
			clockPulse: {
				intervalMs: 10_000,
				remainingMs: 7_500,
				enabled: true,
			},
		});
		const actor = createDeliveryActor(current);
		for (const clockPulse of [
			{
				intervalMs: 10_000,
				remainingMs: 7_400,
				enabled: true,
			},
			{
				intervalMs: 10_000,
				remainingMs: 7_500,
				enabled: false,
			},
			undefined,
		]) {
			const update = classifyActorUpdateFn({
				actor,
				displayItem: {
					...current,
					clockPulse,
				},
				deliveryRetained: false,
				directLanding: false,
				motionClaimed: false,
				pose: {
					layer: null as never,
					size: 80,
					x: 40,
					y: 60,
				},
				poseChannelActive: false,
				preserveVisual: false,
			});
			expect(update.item).toEqual({
				kind: "progress",
			});
			expect(update.activityEffect).toBeNull();
			expect(update.pose).toEqual({
				kind: "place",
			});
		}
	});
});
