// @vitest-environment jsdom

import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createActor, createSpawnHarness, palette } from "./createMotionRuntimeFx.test/fixture";

import { createActorAnimatorFx } from "~/tile-rendering/fx/createActorAnimatorFx";
import type { AnimationDriver } from "~/tile-rendering/service/AnimationDriver";
import { createMotionRuntimeFx } from "~/tile-motion/fx/createMotionRuntimeFx";

describe("spawn ownership transfer to delivery", () => {
	for (const phase of [
		"active",
		"pending",
		"last",
	]) {
		it(`releases ${phase} spawn claims without destroying the delivery actor`, () => {
			const harness = createSpawnHarness();
			const { actorStore, application, magneticField, spawnCue, spawned, surface } = harness;
			const tweens: Array<{
				props: Parameters<AnimationDriver["startTweenFx"]>[0];
				active: boolean;
			}> = [];
			const animator = Effect.runSync(
				createActorAnimatorFx({
					frames: application.frames,
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
			const runtime = Effect.runSync(
				createMotionRuntimeFx({
					actorStore,
					animator,
					application,
					magneticField,
					surface,
					readPaletteFn: () => palette,
					textures: {} as never,
				}),
			);
			const producer = createActor(spawnCue.originActorId);
			Effect.runSync(actorStore.setActorFx(producer));
			const nextSpawn = {
				...harness.blockerCue,
				sequence: 12,
			};
			Effect.runSync(
				runtime.enqueueFx(
					phase === "pending"
						? [
								harness.blockerCue,
								spawnCue,
							]
						: phase === "last"
							? [
									spawnCue,
								]
							: [
									spawnCue,
									nextSpawn,
								],
				),
			);
			Effect.runSync(runtime.startFx);
			for (const tween of tweens) if (tween.active) tween.props.onUpdateFn(0.4);
			const livePose = {
				x: spawned.container.x,
				y: spawned.container.y,
			};
			// Canonical delivery has left the grid; neither it nor its depleted producer is canonical.
			Effect.runSync(
				actorStore.replaceCanonicalItemsFx([
					harness.blocker.item,
				]),
			);
			Effect.runSync(
				runtime.handoffDeliveriesFx(
					new Set([
						spawned.item.id,
					]),
				),
			);
			expect(spawned.container.destroyed).toBe(false);
			expect(spawned.container).toMatchObject(livePose);
			expect(
				Effect.runSync(runtime.readSnapshotFx).spawnCueByActorId.has(spawned.item.id),
			).toBe(false);
			Effect.runSync(
				animator.animateFx({
					actor: spawned,
					channel: "pose",
					ownerKey: "delivery:water",
					durationMs: 500,
					readPoseFn: () => ({
						x: 350,
						y: 200,
						scale: 1,
					}),
				}),
			);
			const deliveryTween = tweens.at(-1)!;
			Effect.runSync(runtime.startFx);
			// Drain production presentation while the delivery still owns its separate writer.
			for (let index = 0; index < tweens.length && index < 100; index += 1) {
				const tween = tweens[index]!;
				if (!tween.active || tween === deliveryTween) continue;
				tween.props.onUpdateFn(1);
				tween.active = false;
				tween.props.onCompleteFn?.();
			}
			expect(Effect.runSync(runtime.readSnapshotFx).retainedActorIds.size).toBe(0);
			expect(actorStore.actors.has(producer.item.id)).toBe(false);
			expect(deliveryTween.active).toBe(true);
			expect(spawned.container.destroyed).toBe(false);
			deliveryTween.props.onUpdateFn(1);
			expect(spawned.container).toMatchObject({
				x: 350,
				y: 200,
			});
			Effect.runSync(runtime.closeFx);
			Effect.runSync(animator.closeFx);
		});
	}
});
