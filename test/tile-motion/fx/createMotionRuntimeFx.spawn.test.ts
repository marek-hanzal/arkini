// @vitest-environment jsdom

import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

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
	createStackHarness,
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

	it.each([
		"dragging",
		"new-pose",
	] as const)("does not steal %s ownership when a retained producer is released", (ownership) => {
		const actor = createActor("runtime:held-producer");
		actor.dragging = ownership === "dragging";
		actor.container.position.set(135, 47);
		const animations: ActorAnimation[] = [];
		const animator = createRecordingAnimator({
			animations,
		});
		Effect.runSync(
			finalizeMotionActorsFx({
				actorIds: new Set([
					actor.item.id,
				]),
				actorStore: createActorStore({
					actors: createActorMap(actor),
					canonicalItems: new Map([
						[
							actor.item.id,
							actor.item,
						],
					]),
				}),
				animator: {
					...animator,
					isChannelActiveFx: () => Effect.succeed(ownership === "new-pose"),
				},
				application: createApplication(),
				onActorSettledFn: () => {},
				readPaletteFn: () => palette,
				stillClaimedActorIds: new Set(),
				surface: createSurface({
					readLocationPose: () => ({
						layer: actor.container,
						x: 200,
						y: 40,
						size: 80,
					}),
				}),
				textures: {} as never,
			}),
		);
		expect(animations).toEqual([]);
		expect(actor.container.x).toBe(135);
		expect(actor.container.y).toBe(47);
	});

	it.each([
		{
			acquired: false,
			label: "before",
		},
		{
			acquired: true,
			label: "after",
		},
	])("closes a stack payload exactly once $label its first travel update", ({ acquired }) => {
		const { animations, canceledOwnerKeys, cue, runtime } = createStackHarness();
		Effect.runSync(
			runtime.enqueueFx([
				cue,
			]),
		);
		Effect.runSync(runtime.startFx);
		const travel = animations.find(
			(animation) => animation.channel === "pose" && animation.ownerKey === "motion:30:0",
		);
		if (travel?.channel !== "pose") throw new Error("Expected a stack payload travel.");
		const transient = travel.actor;
		const destroy = vi.spyOn(transient.container, "destroy");
		if (acquired) samplePoseAnimation(travel, 0.2);

		Effect.runSync(runtime.closeFx);
		Effect.runSync(runtime.closeFx);

		expect(canceledOwnerKeys).toContain("motion:30:0");
		expect(transient.container.destroyed).toBe(true);
		expect(destroy).toHaveBeenCalledOnce();
		expect(Effect.runSync(runtime.readSnapshotFx).quantityPresentationByActorId).toEqual(
			new Map(),
		);
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
