// @vitest-environment jsdom
import { runVisualReadinessFx } from "~/tile-rendering/fx/runVisualReadinessFx";
import { Effect } from "effect";
import { expect, it } from "vitest";
import { lifecycleDurationMs } from "~/tile-rendering/fx/runActorLifecycleFx";
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
	"absent",
	"ready",
	"cold",
] as const)(
	"starts removed producer exit with its outgoing output (same-slot successor: %s)",
	(successor) => {
		const source = createActor("source");
		source.container.alpha = 1;
		source.container.eventMode = "static";
		source.lifecycleTargetAlpha = 1;
		const outgoing = createActor("outgoing");
		outgoing.item = {
			...outgoing.item,
			location: secondBoardLocation,
		};
		const local = createActor("local");
		if (successor === "cold") local.currentVisual.textureState = "loading";
		const outputs =
			successor === "absent"
				? [
						outgoing,
					]
				: [
						local,
						outgoing,
					];
		const { runtime, animations } = createMotionHarness({
			actors: createActorMap(source, ...outputs),
			canonicalItems: createItemMap(...outputs.map((actor) => actor.item)),
		});
		const cues: TileMotionCue[] = outputs.map((actor, index) => ({
			kind: "spawn",
			actorId: actor.item.id,
			originActorId: source.item.id,
			originLocation: firstBoardLocation,
			targetLocation: actor.item.location,
			sequence: 50,
			eventIndex: index,
			staggerIndex: index,
		}));
		try {
			Effect.runSync(runtime.enqueueFx(cues));
			Effect.runSync(runtime.startFx);
			expect(source.container.eventMode).toBe("none");
			const sourceExit = animations.find(
				(animation) =>
					animation.actor === source && animation.channel === "lifecycle-opacity",
			);
			expect(sourceExit).toMatchObject({
				toAlpha: 0,
				delayMs: 0,
				durationMs: lifecycleDurationMs,
			});
			expect(source.lifecycleTargetAlpha).toBe(0);
			expect(source.container.destroyed).toBe(false);
			expect(
				Effect.runSync(runtime.readSnapshotFx).retainedActorIds.has(source.item.id),
			).toBe(true);
			const travel = readPoseAnimation(animations, outgoing);
			if (successor === "cold") {
				expect(
					animations.some(
						(animation) =>
							animation.actor === local && animation.channel === "lifecycle-opacity",
					),
				).toBe(false);
				Effect.runSync(
					runVisualReadinessFx({
						kind: "complete",
						visual: local.currentVisual,
						generation: local.currentVisual.textureGeneration,
					}),
				);
			}
			// The visual exit may finish while its geometry remains claimed by output travel.
			source.container.alpha = 0;
			sourceExit?.onCompleteFn?.();
			expect(source.container.destroyed).toBe(false);
			if (successor !== "absent") {
				const localTravel = readPoseAnimation(animations, local);
				samplePoseAnimation(localTravel, 1);
				localTravel.onCompleteFn?.();
			}
			samplePoseAnimation(travel, 1);
			travel.onCompleteFn?.();
			expect(source.container.destroyed).toBe(true);
			expect(outgoing.container.destroyed).toBe(false);
			expect(Effect.runSync(runtime.readSnapshotFx).retainedActorIds.size).toBe(0);
		} finally {
			Effect.runSync(runtime.closeFx);
		}
	},
);
