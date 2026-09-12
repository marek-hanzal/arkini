// @vitest-environment jsdom

import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import { lifecycleDurationMs } from "~/tile-rendering/fx/runActorLifecycleFx";
import { finalizeMotionActorsFx } from "~/tile-motion/fx/finalizeMotionActorsFx";

import {
	createActorMap,
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
	it.each([
		{
			acquired: false,
			label: "before",
		},
		{
			acquired: true,
			label: "after",
		},
	])(
		"closes a stack payload exactly once $label its first magnetic projection",
		({ acquired }) => {
			const {
				animations,
				canceledOwnerKeys,
				cue,
				magneticReleases,
				magneticUpdates,
				runtime,
			} = createStackHarness();
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
			expect(magneticUpdates.length > 0).toBe(acquired);
			expect(magneticReleases).toEqual(
				acquired
					? [
							{
								sourceActorId: transient.item.id,
								sourceKind: "motion",
							},
						]
					: [],
			);
			expect(Effect.runSync(runtime.readSnapshotFx).quantityPresentationByActorId).toEqual(
				new Map(),
			);
		},
	);

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
