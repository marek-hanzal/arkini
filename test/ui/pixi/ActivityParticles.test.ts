import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { burstAckParticlesFx } from "~/ui/pixi/animation/burstAckParticlesFx";
import { startActivityParticlesFx } from "~/ui/pixi/animation/startActivityParticlesFx";
import { stopActivityParticlesFx } from "~/ui/pixi/animation/stopActivityParticlesFx";

import {
	createParticleActor,
	createActivityParticleAnimator,
} from "./ActivityParticles.test/fixture";

const ownerKey = "activity-particles:pixi-tile:producer";

describe("activity particles", () => {
	it("starts one durable running owner without a stale completion chain", () => {
		const actor = createParticleActor();
		const { animations, animator, cancellations, writes } = createActivityParticleAnimator();

		Effect.runSync(
			startActivityParticlesFx({
				actor,
				animator,
			}),
		);

		expect(cancellations).toEqual([
			ownerKey,
		]);
		expect(writes).toEqual([
			{
				actor,
				channel: "activity-particles",
				reset: true,
				visible: true,
			},
		]);
		expect(animations).toHaveLength(1);
		expect(animations[0]).toMatchObject({
			actor,
			channel: "activity-particles",
			ownerKey,
			repeat: Number.POSITIVE_INFINITY,
		});
		expect(animations[0]?.onComplete).toBeUndefined();
	});

	it("drains a stopped running owner before releasing its shared pool", () => {
		const actor = createParticleActor();
		const { animations, animator, cancellations } = createActivityParticleAnimator();
		actor.activityParticles.container.visible = true;
		actor.activityParticles.lastProgress = 0.42;
		actor.item = {
			...actor.item,
			activityEffect: false,
		};

		Effect.runSync(
			stopActivityParticlesFx({
				actor,
				animator,
			}),
		);

		expect(cancellations).toEqual([
			ownerKey,
		]);
		expect(actor.activityParticles.feedbackPhase).toBe("draining");
		expect(animations[0]).toMatchObject({
			channel: "activity-particles",
			ownerKey,
		});
		animations[0]?.onComplete?.();
		expect(actor.activityParticles.container.visible).toBe(false);
		expect(actor.activityParticles.feedbackPhase).toBeNull();
	});

	it("hands a live ACK owner to running feedback only after ACK settlement", () => {
		const actor = createParticleActor();
		const { animations, animator, cancellations } = createActivityParticleAnimator();
		actor.item = {
			...actor.item,
			activityEffect: false,
		};
		Effect.runSync(
			burstAckParticlesFx({
				actor,
				animator,
				tint: 0x57d7b2,
			}),
		);
		actor.item = {
			...actor.item,
			activityEffect: true,
		};

		Effect.runSync(
			startActivityParticlesFx({
				actor,
				animator,
			}),
		);

		expect(animations).toHaveLength(1);
		expect(cancellations).toEqual([
			ownerKey,
		]);
		expect(actor.activityParticles.feedbackPhase).toBe("burst");
		animations[0]?.onComplete?.();
		expect(animations).toHaveLength(2);
		expect(animations[1]).toMatchObject({
			channel: "activity-particles",
			ownerKey,
			repeat: Number.POSITIVE_INFINITY,
		});
		expect(actor.activityParticles.feedbackPhase).toBeNull();
	});

	it("does not let an instant stop cancel an unsettled ACK", () => {
		const actor = createParticleActor();
		const { animations, animator, cancellations } = createActivityParticleAnimator();
		Effect.runSync(
			burstAckParticlesFx({
				actor,
				animator,
				tint: 0x57d7b2,
			}),
		);
		actor.item = {
			...actor.item,
			activityEffect: false,
		};

		Effect.runSync(
			stopActivityParticlesFx({
				actor,
				animator,
			}),
		);

		expect(animations).toHaveLength(1);
		expect(cancellations).toEqual([
			ownerKey,
		]);
		expect(actor.activityParticles.feedbackPhase).toBe("burst");
		animations[0]?.onComplete?.();
		expect(actor.activityParticles.container.visible).toBe(false);
	});
});
