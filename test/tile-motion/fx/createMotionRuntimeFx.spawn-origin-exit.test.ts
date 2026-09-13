// @vitest-environment jsdom
import { runVisualReadinessFx } from "~/tile-rendering/fx/runVisualReadinessFx";
import { Effect } from "effect";
import { expect, it } from "vitest";
import { lifecycleDurationMs, runActorLifecycleFx } from "~/tile-rendering/fx/runActorLifecycleFx";
import {
	createMotionHarness,
	createActorMap,
	createItemMap,
	createActor,
	firstBoardLocation,
	secondBoardLocation,
	readPoseAnimation,
	samplePoseAnimation,
	type TileMotionCue,
} from "./createMotionRuntimeFx.test/fixture";

it.each([
	false,
	true,
])(
	"reveals the source-slot drop together with source exit after outgoing drops and artwork readiness (cold: %s)",
	(cold) => {
		const source = createActor("source");
		const local = createActor("local");
		if (cold) local.currentVisual.textureState = "loading";
		const outgoing = createActor("outgoing");
		source.item = {
			...source.item,
			location: firstBoardLocation,
		};
		local.item = {
			...local.item,
			location: firstBoardLocation,
		};
		outgoing.item = {
			...outgoing.item,
			location: secondBoardLocation,
		};
		const { runtime, animator, animations, exitingActors } = createMotionHarness({
			actors: createActorMap(source, local, outgoing),
			canonicalItems: createItemMap(local.item, outgoing.item),
		});
		Effect.runSync(
			runActorLifecycleFx({
				kind: "prepare-enter",
				actor: local,
				animator,
			}),
		);
		const cues: TileMotionCue[] = [
			{
				kind: "spawn",
				actorId: local.item.id,
				originActorId: source.item.id,
				originLocation: firstBoardLocation,
				targetLocation: firstBoardLocation,
				sequence: 50,
				eventIndex: 0,
				staggerIndex: 0,
				revealAtOriginExit: true,
			},
			{
				kind: "spawn",
				actorId: outgoing.item.id,
				originActorId: source.item.id,
				originLocation: firstBoardLocation,
				targetLocation: secondBoardLocation,
				sequence: 50,
				eventIndex: 1,
				staggerIndex: 1,
			},
		];
		Effect.runSync(runtime.enqueueFx(cues));
		Effect.runSync(runtime.startFx);
		expect(local.container.alpha).toBe(0);
		expect(animations.some((animation) => animation.actor === local)).toBe(false);
		expect(exitingActors.has(source)).toBe(false);
		const travel = readPoseAnimation(animations, outgoing);
		samplePoseAnimation(travel, 1);
		travel.onCompleteFn?.();
		if (cold) {
			expect(exitingActors.has(source)).toBe(false);
			expect(animations.some((animation) => animation.actor === local)).toBe(false);
			Effect.runSync(
				runVisualReadinessFx({
					kind: "complete",
					visual: local.currentVisual,
					generation: local.currentVisual.textureGeneration,
				}),
			);
		}
		expect(exitingActors.has(source)).toBe(true);
		const sourceExit = animations.find(
			(animation) => animation.actor === source && animation.channel === "lifecycle-opacity",
		);
		const localEnter = animations.find(
			(animation) => animation.actor === local && animation.channel === "lifecycle-opacity",
		);
		expect(sourceExit).toMatchObject({
			toAlpha: 0,
			delayMs: 0,
			durationMs: lifecycleDurationMs,
		});
		expect(localEnter).toMatchObject({
			toAlpha: 1,
			delayMs: 0,
			durationMs: lifecycleDurationMs,
		});
		const localTravel = readPoseAnimation(animations, local);
		expect(samplePoseAnimation(localTravel, 0)).toEqual(samplePoseAnimation(localTravel, 1));
		localTravel.onCompleteFn?.();
		sourceExit?.onCompleteFn?.();
		expect(source.container.destroyed).toBe(true);
		expect(local.container.destroyed).toBe(false);
		expect(Effect.runSync(runtime.readSnapshotFx).retainedActorIds.size).toBe(0);
		Effect.runSync(runtime.closeFx);
	},
);

it("does not revive a waiting local reveal after the motion runtime closes", () => {
	const source = createActor("source");
	const local = createActor("local");
	local.currentVisual.textureState = "loading";
	const { runtime, animations, exitingActors } = createMotionHarness({
		actors: createActorMap(source, local),
		canonicalItems: createItemMap(local.item),
	});
	Effect.runSync(
		runtime.enqueueFx([
			{
				kind: "spawn",
				actorId: local.item.id,
				originActorId: source.item.id,
				originLocation: firstBoardLocation,
				targetLocation: firstBoardLocation,
				sequence: 51,
				eventIndex: 0,
				staggerIndex: 0,
				revealAtOriginExit: true,
			},
		]),
	);
	Effect.runSync(runtime.startFx);
	expect(animations).toHaveLength(0);
	Effect.runSync(runtime.closeFx);
	Effect.runSync(
		runVisualReadinessFx({
			kind: "complete",
			visual: local.currentVisual,
			generation: local.currentVisual.textureGeneration,
		}),
	);
	expect(animations).toHaveLength(0);
	expect(exitingActors.size).toBe(0);
});
