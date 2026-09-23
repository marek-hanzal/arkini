// @vitest-environment jsdom

import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
	createActor,
	createActorMap,
	createItemMap,
	createMotionHarness,
	createSpawnHarness,
	firstBoardLocation,
	secondBoardLocation,
	readPoseAnimation,
} from "./createMotionRuntimeFx.test/fixture";

describe("motion space replacement", () => {
	it("retires active and queued outputs before stale completion can restart them", () => {
		const {
			runtime,
			blockerCue,
			spawnCue,
			blocker,
			spawned,
			actorStore,
			animations,
			canceledOwnerKeys,
		} = createSpawnHarness();
		Effect.runSync(
			runtime.enqueueFx([
				blockerCue,
				spawnCue,
			]),
		);
		Effect.runSync(runtime.startFx);
		const active = readPoseAnimation(animations, blocker);
		Effect.runSync(actorStore.replaceCanonicalItemsFx([]));
		Effect.runSync(runtime.cancelSpaceFx(0));
		const count = animations.length;
		active.onCompleteFn?.();
		Effect.runSync(runtime.startFx);
		expect(animations).toHaveLength(count);
		expect(canceledOwnerKeys).toContain("motion:10:0");
		expect(canceledOwnerKeys).toContain("motion:11:0");
		expect(Effect.runSync(runtime.readSnapshotFx).retainedActorIds.size).toBe(0);
		expect(actorStore.actors.has(blocker.item.id)).toBe(false);
		expect(actorStore.actors.has(spawned.item.id)).toBe(false);
	});

	it("cancels cues targeting the replaced space while retaining unrelated space motion", () => {
		const affected = createActor("affected");
		const other = createActor("other");
		const { runtime, canceledOwnerKeys } = createMotionHarness({
			actors: createActorMap(affected, other),
			canonicalItems: createItemMap(other.item),
		});
		const cue = {
			kind: "spawn" as const,
			actorId: affected.item.id,
			originActorId: "producer",
			originLocation: {
				...firstBoardLocation,
				space: 1,
			},
			targetLocation: secondBoardLocation,
			eventIndex: 0,
			sequence: 1,
			staggerIndex: 0,
		};
		Effect.runSync(
			runtime.enqueueFx([
				cue,
				{
					...cue,
					actorId: other.item.id,
					originActorId: "other-producer",
					sequence: 2,
					targetLocation: {
						...secondBoardLocation,
						space: 1,
					},
				},
			]),
		);
		Effect.runSync(runtime.startFx);
		Effect.runSync(runtime.cancelSpaceFx(0));
		const snapshot = Effect.runSync(runtime.readSnapshotFx);
		expect(snapshot.interactionClaimByActorId.has(affected.item.id)).toBe(false);
		expect(snapshot.interactionClaimByActorId.has(other.item.id)).toBe(true);
		expect(canceledOwnerKeys).toContain("motion:1:0");
		expect(canceledOwnerKeys).not.toContain("motion:2:0");
	});
});
