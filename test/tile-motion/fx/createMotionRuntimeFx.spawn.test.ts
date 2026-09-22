// @vitest-environment jsdom

import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { lifecycleDurationMs } from "~/tile-rendering/fx/runActorLifecycleFx";
import { finalizeMotionActorsFx } from "~/tile-motion/fx/finalizeMotionActorsFx";

import {
	createActorMap,
	createMotionHarness,
	createItem,
	firstBoardLocation,
	secondBoardLocation,
	readPoseAnimation,
	createActorStore,
	createApplication,
	createSurface,
	createActor,
	createRecordingAnimator,
	samplePoseAnimation,
	palette,
	type PixiTileActor,
	type ActorAnimation,
} from "./createMotionRuntimeFx.test/fixture";

describe("spawn lifecycle", () => {
	it("settles a completed spawn toward the latest canonical location without a successor cue", () => {
		const actor = createActor("runtime:relocated-spawn");
		actor.item = createItem(actor.item.id, firstBoardLocation);
		const canonicalItems = new Map([
			[
				actor.item.id,
				actor.item,
			],
		]);
		const { runtime, animations, settledActors } = createMotionHarness({
			actors: createActorMap(actor),
			canonicalItems,
		});
		Effect.runSync(
			runtime.enqueueFx([
				{
					kind: "spawn",
					actorId: actor.item.id,
					originActorId: "runtime:producer",
					originLocation: secondBoardLocation,
					targetLocation: firstBoardLocation,
					sequence: 50,
					eventIndex: 0,
					staggerIndex: 0,
				},
			]),
		);
		Effect.runSync(runtime.startFx);
		const travel = readPoseAnimation(animations, actor);
		canonicalItems.set(actor.item.id, createItem(actor.item.id, secondBoardLocation));
		samplePoseAnimation(travel, 1);
		travel.onCompleteFn?.();
		const settling = animations.find(
			(entry) =>
				entry.channel === "pose" &&
				entry.ownerKey === `motion-finalize:${actor.instanceId}`,
		);
		if (settling?.channel !== "pose") throw new Error("Expected canonical pose recovery.");
		expect(actor.container.x).toBe(firstBoardLocation.position.x * 100);
		expect(settledActors).not.toContain(actor);
		samplePoseAnimation(settling, 1);
		settling.onCompleteFn?.();
		expect(actor.container.x).toBe(secondBoardLocation.position.x * 100);
		expect(settledActors).toContain(actor);
		Effect.runSync(runtime.closeFx);
	});

	it("supersedes an unfinished spawn fade when the actor disappears at settlement", () => {
		const actor = createActor("runtime:short-lived-spawn");
		actor.container.alpha = 0.37;
		const actors = createActorMap(actor);
		const animations: ActorAnimation[] = [];
		const exitingActors = new Set<PixiTileActor>();

		Effect.runSync(
			finalizeMotionActorsFx({
				actorIds: new Set([
					actor.item.id,
				]),
				actorStore: createActorStore({
					actors,
					canonicalItems: new Map(),
					exitingActors,
				}),
				animator: createRecordingAnimator({
					animations,
				}),
				application: createApplication(),
				onActorSettledFn: () => {},
				readPaletteFn: () => palette,
				stillClaimedActorIds: new Set(),
				surface: createSurface(),
				textures: {} as never,
			}),
		);

		expect(actors.has(actor.item.id)).toBe(false);
		expect(actor.container.alpha).toBe(0.37);
		expect(animations).toEqual([
			expect.objectContaining({
				actor,
				channel: "lifecycle-scale",
				durationMs: lifecycleDurationMs,
			}),
			expect.objectContaining({
				actor,
				channel: "lifecycle-opacity",
				durationMs: lifecycleDurationMs,
				toAlpha: 0,
			}),
		]);
		expect(actor.container.destroyed).toBe(false);
		animations.find((animation) => animation.channel === "lifecycle-opacity")?.onCompleteFn?.();
		expect(actor.container.destroyed).toBe(true);
	});
});
