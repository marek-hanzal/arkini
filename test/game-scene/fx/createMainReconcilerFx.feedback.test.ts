import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import { burstFeedbackParticlesFx } from "~/tile-rendering/fx/burstFeedbackParticlesFx";

import {
	boardLocation,
	createActor,
	createItem,
	createReconcilerHarness,
	projectionProbeState as projectionState,
	transition,
} from "./createMainReconcilerFx.test/fixture";

describe("main reconciliation / feedback acknowledgements", () => {
	it("bursts a surviving committed feedback receiver exactly once", () => {
		const item = createItem("runtime:tree", boardLocation);
		const actor = createActor(item);
		const harness = createReconcilerHarness({
			actor,
		});
		projectionState.main = [
			item,
		];
		projectionState.feedback = [
			{
				actorId: item.id,
				key: "2:0:resource-spent",
				kind: "resource-spent",
			},
		];

		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));
		expect(harness.animations).toContainEqual(
			expect.objectContaining({
				actor,
				channel: "activity-particles",
				durationMs: 720,
				ownerKey: `activity-particles:${actor.instanceId}`,
			}),
		);
		const animationCount = harness.animations.length;

		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));
		expect(harness.animations).toHaveLength(animationCount);
	});
	it("keeps a success ACK alive across an instant running-to-idle transition", () => {
		const idle = createItem("runtime:producer", boardLocation);
		const running = {
			...idle,
			revision: "revision:producer:running",
			running: true,
			activityEffect: true,
		} satisfies TileActorItem;
		const settled = {
			...idle,
			revision: "revision:producer:settled",
		} satisfies TileActorItem;
		const actor = createActor(idle);
		const harness = createReconcilerHarness({
			actor,
		});
		Effect.runSync(
			burstFeedbackParticlesFx({
				actor,
				animator: harness.animator,
				tint: 0x57d7b2,
			}),
		);
		projectionState.main = [
			running,
		];

		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));
		expect(actor.activityParticles.feedbackPhase).toBe("burst");
		expect(
			harness.animations.filter(
				(animation) =>
					animation.actor === actor && animation.channel === "activity-particles",
			),
		).toHaveLength(1);

		projectionState.main = [
			settled,
		];
		projectionState.feedback = [];
		Effect.runSync(harness.reconciler.reconcileFx(transition(3)));

		expect(actor.activityParticles.feedbackPhase).toBe("burst");
		expect(
			harness.animations.filter(
				(animation) =>
					animation.actor === actor && animation.channel === "activity-particles",
			),
		).toHaveLength(1);
	});
});
