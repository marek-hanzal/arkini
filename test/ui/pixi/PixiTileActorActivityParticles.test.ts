import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { burstPixiTileActorAckParticlesFx } from "~/ui/pixi/animation/burstPixiTileActorAckParticlesFx";
import { startPixiTileActorActivityParticlesFx } from "~/ui/pixi/animation/startPixiTileActorActivityParticlesFx";
import { stopPixiTileActorActivityParticlesFx } from "~/ui/pixi/animation/stopPixiTileActorActivityParticlesFx";

import {
	createActivityParticleActor,
	createActivityParticleAnimator,
} from "./PixiTileActorActivityParticles.test/fixture";

const ownerKey = "activity-particles:pixi-tile:producer";

describe("Pixi tile actor activity particles", () => {
	it("starts one durable running owner without a stale completion chain", () => {
		const actor = createActivityParticleActor();
		const { animations, animator, cancellations, writes } = createActivityParticleAnimator();

		Effect.runSync(
			startPixiTileActorActivityParticlesFx({
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
		const actor = createActivityParticleActor();
		const { animations, animator, cancellations } = createActivityParticleAnimator();
		actor.activityParticles.container.visible = true;
		actor.activityParticles.lastProgress = 0.42;
		actor.item = {
			...actor.item,
			activityEffect: false,
		};

		Effect.runSync(
			stopPixiTileActorActivityParticlesFx({
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
		const actor = createActivityParticleActor();
		const { animations, animator, cancellations } = createActivityParticleAnimator();
		actor.item = {
			...actor.item,
			activityEffect: false,
		};
		Effect.runSync(
			burstPixiTileActorAckParticlesFx({
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
			startPixiTileActorActivityParticlesFx({
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
		const actor = createActivityParticleActor();
		const { animations, animator, cancellations } = createActivityParticleAnimator();
		Effect.runSync(
			burstPixiTileActorAckParticlesFx({
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
			stopPixiTileActorActivityParticlesFx({
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
