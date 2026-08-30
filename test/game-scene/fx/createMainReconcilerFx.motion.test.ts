import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { settleDraggedActorFx } from "~/tile-interaction/fx/settleDraggedActorFx";

import {
	boardLocation,
	createActor,
	createItem,
	createReconcilerHarness,
	projectionProbeState as projectionState,
	transition,
} from "./createMainReconcilerFx.test/fixture";

describe("main reconciliation / layout and landing", () => {
	it("retargets an active layout settle from its live frame on repeated resize hydration", () => {
		const item = createItem("runtime:resizing-water", boardLocation);
		const actor = createActor(item);
		const pose = {
			size: 80,
			x: 420,
			y: 340,
		};
		const harness = createReconcilerHarness({
			actor,
			pose,
		});
		projectionState.main = [
			item,
		];

		Effect.runSync(harness.reconciler.hydrateFx(transition(2)));

		const travel = harness.animations.find(
			(animation) => animation.actor === actor && animation.channel === "pose",
		);
		if (travel?.channel !== "pose" || travel.readPose === undefined) {
			throw new Error("Expected a retargetable layout settle.");
		}
		const beforeResize = travel.readPose(0.4);
		actor.container.position.set(beforeResize.x, beforeResize.y);
		actor.container.scale.set(beforeResize.scale ?? 1);
		pose.size = 120;
		pose.x = 700;
		pose.y = 500;

		Effect.runSync(harness.reconciler.hydrateFx(transition(2)));

		const resizeTravels = harness.animations.filter(
			(animation) => animation.actor === actor && animation.channel === "pose",
		);
		expect(resizeTravels).toHaveLength(2);
		const retargeted = resizeTravels.at(-1);
		if (retargeted?.channel !== "pose" || retargeted.readPose === undefined) {
			throw new Error("Expected resize hydration to retarget the active settle.");
		}
		const retargetedStart = retargeted.readPose(0);
		expect(retargetedStart).toMatchObject({
			x: beforeResize.x,
			y: beforeResize.y,
		});
		expect((retargetedStart.scale ?? 1) * actor.size).toBe((beforeResize.scale ?? 1) * 80);
		expect(retargeted.readPose(1)).toEqual({
			scale: 1,
			x: 700,
			y: 500,
		});
		expect(actor.size).toBe(120);
	});
	it("springs a directly dropped actor into its committed slot", () => {
		const previous = createItem("runtime:dropped-water", boardLocation);
		const destination = {
			...boardLocation,
			position: {
				x: 4,
				y: 3,
			},
		};
		const current = createItem(previous.id, destination);
		const actor = createActor(previous);
		const harness = createReconcilerHarness({
			actor,
			pose: {
				size: 80,
				x: 420,
				y: 340,
			},
		});
		const generation = Effect.runSync(
			harness.dropPresentation.beginFx({
				sourceActorId: previous.id,
				swapCandidate: null,
			}),
		);
		Effect.runSync(
			harness.dropPresentation.completeFx({
				generation,
				result: {
					itemId: current.id,
					kind: "move",
					location: destination,
					previousLocation: boardLocation,
					revision: current.revision,
				},
			}),
		);
		projectionState.main = [
			current,
		];

		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));

		const landing = harness.animations.find(
			(animation) => animation.actor === actor && animation.channel === "pose",
		);
		expect(landing).toMatchObject({
			curve: {
				bounce: 0.14,
				kind: "spring",
			},
		});
		expect(landing?.durationMs).toBeLessThan(280);
		expect(Effect.runSync(harness.dropPresentation.readSnapshotFx).landingActorIds).toEqual(
			new Set(),
		);
	});
	it("does not restart a direct landing when a running job ticks mid-flight", () => {
		const previous = createItem("runtime:dropped-water", boardLocation);
		const destination = {
			...boardLocation,
			position: {
				x: 4,
				y: 3,
			},
		};
		const current = createItem(previous.id, destination);
		const actor = createActor(previous);
		const harness = createReconcilerHarness({
			actor,
			pose: {
				size: 80,
				x: 420,
				y: 340,
			},
		});
		const generation = Effect.runSync(
			harness.dropPresentation.beginFx({
				sourceActorId: previous.id,
				swapCandidate: null,
			}),
		);
		Effect.runSync(
			harness.dropPresentation.completeFx({
				generation,
				result: {
					itemId: current.id,
					kind: "move",
					location: destination,
					previousLocation: boardLocation,
					revision: current.revision,
				},
			}),
		);
		projectionState.main = [
			current,
		];

		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));
		const landing = harness.animations.find(
			(animation) => animation.actor === actor && animation.channel === "pose",
		);
		projectionState.main = [
			{
				...current,
				activityEffect: true,
				revision: `${current.revision}:tick`,
				running: true,
			},
		];

		Effect.runSync(harness.reconciler.reconcileFx(transition(3)));

		expect(
			harness.animations.filter(
				(animation) => animation.actor === actor && animation.channel === "pose",
			),
		).toEqual([
			landing,
		]);
	});
	it("does not restart a rejected-drop return when a running job ticks mid-flight", () => {
		const current = createItem("runtime:rejected-trash", boardLocation, {
			itemId: "trash",
			title: "Trash",
		});
		const actor = createActor(current);
		actor.container.position.set(500, 400);
		const harness = createReconcilerHarness({
			actor,
		});
		projectionState.main = [
			current,
		];
		Effect.runSync(
			settleDraggedActorFx({
				actor,
				animator: harness.animator,
				surface: harness.surface,
			}),
		);
		const returning = harness.animations.find(
			(animation) => animation.actor === actor && animation.channel === "pose",
		);
		projectionState.main = [
			{
				...current,
				activityEffect: true,
				revision: `${current.revision}:tick`,
				running: true,
			},
		];

		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));

		expect(
			harness.animations.filter(
				(animation) => animation.actor === actor && animation.channel === "pose",
			),
		).toEqual([
			returning,
		]);
	});
});
