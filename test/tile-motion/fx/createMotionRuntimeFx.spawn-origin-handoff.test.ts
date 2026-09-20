// @vitest-environment jsdom

import { Effect } from "effect";
import { expect, it } from "vitest";

import { settleDraggedActorFx } from "~/tile-interaction/fx/settleDraggedActorFx";
import { readTileMotionCuesFn } from "~/tile-presentation/fn/readTileMotionCuesFn";
import {
	createMotionHarness,
	createActor,
	createActorMap,
	createItemMap,
	firstBoardLocation,
	secondBoardLocation,
	readPoseAnimation,
	samplePoseAnimation,
	type TileMotionCue,
} from "./createMotionRuntimeFx.test/fixture";
import { createDepletedSpawnTransitionFx } from "./createMotionRuntimeFx.spawn-origin-handoff.test/fixture";

it("exits a depleted spawn origin when the player grabs its final output then cancels the drag", () => {
	const { transition, afterIdleTick } = Effect.runSync(createDepletedSpawnTransitionFx());
	// A stable engine cannot be relied upon to publish another cleanup transition.
	expect(transition.runtime.jobs).toHaveLength(0);
	expect(afterIdleTick.sequence).toBe(transition.sequence);
	const cues = readTileMotionCuesFn({
		transition,
	});
	expect(cues).toHaveLength(1);
	const cue = cues[0];
	if (cue?.kind !== "spawn") throw new Error("Expected a depletion spawn.");
	expect(transition.runtime.items.some((item) => item.id === cue.originActorId)).toBe(false);
	const source = createActor(cue.originActorId);
	source.lifecycleTargetAlpha = 1;
	source.item = {
		...source.item,
		location: cue.originLocation,
	};
	source.container.alpha = 1;
	const child = createActor(cue.actorId);
	child.item = {
		...child.item,
		location: cue.targetLocation,
	};
	const { runtime, actorStore, actorLayer, animations, animator, surface, exitingActors } =
		createMotionHarness({
			actors: createActorMap(source, child),
			canonicalItems: createItemMap(child.item),
		});
	actorLayer.addChild(source.container);
	try {
		Effect.runSync(runtime.enqueueFx(cues));
		Effect.runSync(runtime.startFx);
		samplePoseAnimation(readPoseAnimation(animations, child), 0.5);
		expect(Effect.runSync(runtime.beginInteractionHandoffFx(child.item.id))).toBe(true);
		child.dragging = true;
		// Wheel cancellation settles only the grabbed actor; it submits no engine command.
		Effect.runSync(
			settleDraggedActorFx({
				actor: child,
				animator,
				surface,
			}),
		);
		animations.at(-1)?.onCompleteFn?.();
		expect(Effect.runSync(runtime.readSnapshotFx).retainedActorIds.size).toBe(0);
		expect(exitingActors.has(source)).toBe(true);
		const exit = animations
			.filter(
				(animation) =>
					animation.actor === source && animation.channel === "lifecycle-opacity",
			)
			.at(-1);
		exit?.onCompleteFn?.();
		expect(source.container.destroyed).toBe(true);
		expect(actorStore.actors.has(source.item.id)).toBe(false);
		expect(child.container.destroyed).toBe(false);
	} finally {
		Effect.runSync(runtime.closeFx);
	}
});

it("retains a shared spawn origin until the last child's handoff releases its claim", () => {
	const source = createActor("source");
	source.lifecycleTargetAlpha = 1;
	source.container.alpha = 1;
	const first = createActor("first");
	const second = createActor("second");
	first.item = {
		...first.item,
		location: secondBoardLocation,
	};
	second.item = {
		...second.item,
		location: {
			...secondBoardLocation,
			position: {
				x: 3,
				y: 0,
			},
		},
	};
	const { runtime, animations, exitingActors } = createMotionHarness({
		actors: createActorMap(source, first, second),
		canonicalItems: createItemMap(first.item, second.item),
	});
	const cues: TileMotionCue[] = [
		first,
		second,
	].map((child, index) => ({
		kind: "spawn",
		actorId: child.item.id,
		originActorId: source.item.id,
		originLocation: firstBoardLocation,
		targetLocation: child.item.location,
		sequence: index + 1,
		eventIndex: index,
		staggerIndex: index,
	}));
	try {
		Effect.runSync(runtime.enqueueFx(cues));
		Effect.runSync(runtime.startFx);
		expect(animations.some((animation) => animation.actor === second)).toBe(false);
		expect(Effect.runSync(runtime.beginInteractionHandoffFx(second.item.id))).toBe(true);
		expect(Effect.runSync(runtime.readSnapshotFx).retainedActorIds.has(source.item.id)).toBe(
			true,
		);
		expect(source.lifecycleTargetAlpha).toBe(0);
		expect(source.container.destroyed).toBe(false);
		expect(Effect.runSync(runtime.beginInteractionHandoffFx(first.item.id))).toBe(true);
		expect(exitingActors.has(source)).toBe(true);
		expect(
			animations.filter(
				(animation) =>
					animation.actor === source && animation.channel === "lifecycle-opacity",
			),
		).toHaveLength(2);
	} finally {
		Effect.runSync(runtime.closeFx);
	}
});
