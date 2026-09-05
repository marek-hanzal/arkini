// @vitest-environment jsdom

import { Effect } from "effect";
import { expect, it } from "vitest";

import {
	createSwapHarness,
	createActor,
	createItem,
	palette,
} from "./createMotionRuntimeFx.test/fixture";
import { createActorAnimatorFx } from "~/tile-rendering/fx/createActorAnimatorFx";
import { createMotionRuntimeFx } from "~/tile-motion/fx/createMotionRuntimeFx";
import { createDeliveryRuntimeFx } from "~/game-scene/fx/createDeliveryRuntimeFx";
import type { AnimationDriver } from "~/tile-rendering/service/AnimationDriver";

for (const phase of [
	"active",
	"pending",
	"detached",
	"both",
] as const) {
	it(`releases ${phase} swap ownership before delivery takes the live actor`, () => {
		const harness = createSwapHarness();
		const tweens: Array<{
			props: Parameters<AnimationDriver["startTweenFx"]>[0];
			active: boolean;
		}> = [];
		const animator = Effect.runSync(
			createActorAnimatorFx({
				frames: harness.application.frames,
				animationDriver: {
					closeFx: Effect.void,
					createSpringFx: () =>
						Effect.succeed({
							closeFx: Effect.void,
							setTargetFx: () => Effect.void,
						}),
					startTweenFx: (props) =>
						Effect.sync(() => {
							const tween = {
								props,
								active: true,
							};
							tweens.push(tween);
							return {
								stopFx: Effect.sync(() => {
									tween.active = false;
								}),
							};
						}),
				},
			}),
		);
		const motion = Effect.runSync(
			createMotionRuntimeFx({
				actorStore: harness.actorStore,
				animator,
				application: harness.application,
				magneticField: harness.magneticField,
				surface: harness.surface,
				readPaletteFn: () => palette,
				textures: {} as never,
			}),
		);
		const delivery = Effect.runSync(
			createDeliveryRuntimeFx({
				actorStore: harness.actorStore,
				animator,
				application: harness.application,
				magneticField: harness.magneticField,
				surface: harness.surface,
				readPaletteFn: () => palette,
				textures: {} as never,
				particleTextures: {} as never,
				drag: {
					detachActorFx: () => Effect.void,
					attachActorFx: () => Effect.void,
				} as never,
			}),
		);
		const receiver = createActor("runtime:receiver");
		receiver.item = createItem(receiver.item.id, {
			scope: "board",
			space: 0,
			position: {
				x: 4,
				y: 0,
			},
		});
		receiver.container.position.set(400, 40);
		harness.actors.set(receiver.item.id, receiver);
		harness.canonicalItems.set(receiver.item.id, receiver.item);
		const deliveryActor = phase === "detached" ? harness.source : harness.target;
		const counterpart = phase === "detached" ? harness.target : harness.source;
		const blocker = {
			kind: "spawn" as const,
			actorId: harness.source.item.id,
			originActorId: "runtime:producer",
			originLocation: harness.cue.originLocation,
			targetLocation: harness.source.item.location,
			sequence: 8,
			eventIndex: 0,
			staggerIndex: 0,
		};
		Effect.runSync(
			motion.enqueueFx(
				phase === "pending"
					? [
							blocker,
							harness.cue,
						]
					: [
							harness.cue,
						],
			),
		);
		Effect.runSync(motion.startFx);
		for (const tween of tweens) if (tween.active) tween.props.onUpdateFn(0.4);
		if (phase === "detached") {
			expect(Effect.runSync(motion.beginInteractionHandoffFx(harness.target.item.id))).toBe(
				true,
			);
			expect(Effect.runSync(motion.readSnapshotFx).retainedActorIds).toEqual(
				new Set([
					harness.source.item.id,
				]),
			);
		}
		const livePose = {
			x: deliveryActor.container.x,
			y: deliveryActor.container.y,
		};
		const deliveryIds = new Set(
			phase === "both"
				? [
						harness.source.item.id,
						harness.target.item.id,
					]
				: [
						deliveryActor.item.id,
					],
		);
		for (const actorId of deliveryIds) harness.canonicalItems.delete(actorId);
		Effect.runSync(motion.handoffDeliveriesFx(deliveryIds));
		expect(deliveryActor.container.destroyed).toBe(false);
		expect(deliveryActor.container).toMatchObject(livePose);
		expect(
			Effect.runSync(motion.readSnapshotFx).interactionClaimByActorId.has(
				deliveryActor.item.id,
			),
		).toBe(false);
		Effect.runSync(
			delivery.syncFx([
				{
					item: deliveryActor.item,
					from: deliveryActor.item.location,
					to: receiver.item.location,
					targetActorId: receiver.item.id,
					phase: "outbound",
					generation: 0,
					remainingDurationMs: 400,
				},
			]),
		);
		const deliveryTween = tweens.at(-1)!;
		const output = createActor("runtime:later-output");
		output.item = createItem(output.item.id, {
			scope: "board",
			space: 0,
			position: {
				x: 3,
				y: 0,
			},
		});
		harness.actors.set(output.item.id, output);
		harness.canonicalItems.set(output.item.id, output.item);
		const producer = phase === "both" ? receiver : counterpart;
		Effect.runSync(
			motion.enqueueFx([
				{
					kind: "spawn",
					actorId: output.item.id,
					originActorId: producer.item.id,
					originLocation: producer.item.location,
					targetLocation: output.item.location,
					sequence: 10,
					eventIndex: 0,
					staggerIndex: 0,
				},
			]),
		);
		Effect.runSync(motion.startFx);
		// Drain the swap counterpart and successors while Delivery retains its separate pose writer.
		for (let index = 0; index < tweens.length && index < 100; index += 1) {
			const tween = tweens[index]!;
			if (!tween.active || tween === deliveryTween) continue;
			tween.props.onUpdateFn(1);
			tween.active = false;
			tween.props.onCompleteFn?.();
		}
		expect(Effect.runSync(motion.readSnapshotFx).retainedActorIds.size).toBe(0);
		expect(Effect.runSync(motion.readSnapshotFx).interactionClaimByActorId.size).toBe(0);
		expect(Effect.runSync(motion.readSnapshotFx).spawnCueByActorId.size).toBe(0);
		expect(deliveryTween.active).toBe(true);
		expect(deliveryActor.container.destroyed).toBe(false);
		expect(counterpart.container.destroyed).toBe(false);
		deliveryTween.props.onUpdateFn(1);
		Effect.runSync(delivery.closeFx);
		Effect.runSync(motion.closeFx);
		Effect.runSync(animator.closeFx);
	});
}
