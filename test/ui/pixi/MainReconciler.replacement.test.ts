import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import type { ActorVisual } from "~/ui/pixi/actor/ActorVisual";
import { runVisualReadinessFx } from "~/ui/pixi/actor/runVisualReadinessFx";
import {
	boardLocation,
	createActor,
	createItem,
	createReconcilerHarness,
	__fixture_createdVisualState as createdVisualState,
	projectionProbeState as projectionState,
	replacementCrossfadeDurationMs,
	transition,
} from "./MainReconciler.test/fixture";

describe("main reconciliation / replacement visuals", () => {
	it("keeps the current visual visible until a complete incoming slot can crossfade", () => {
		const previous = createItem("runtime:producer", boardLocation, {
			itemId: "producer:idle",
			revision: "revision:producer-idle",
			sourceUrl: "resource:producer-idle",
			title: "Idle producer",
		});
		const current = createItem(previous.id, boardLocation, {
			itemId: "producer:running",
			revision: "revision:producer-running",
			running: true,
			activityEffect: true,
			sourceUrl: "resource:producer-running",
			title: "Running producer",
		});
		const actor = createActor(previous);
		const oldVisual = actor.currentVisual;
		const harness = createReconcilerHarness({
			actor,
		});
		projectionState.main = [
			current,
		];
		projectionState.replacements = [
			{
				actorId: current.id,
				key: "2:0:replacement",
				previous: {
					compositeUrl: previous.compositeUrl,
					itemId: previous.itemId,
					sourceUrl: previous.sourceUrl,
					title: previous.title,
				},
				previousQuantity: previous.quantity,
			},
		];

		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));
		const incoming = createdVisualState.created[0] as ActorVisual;
		expect(incoming).toBeDefined();
		expect(actor.currentVisual).toBe(oldVisual);
		expect(actor.pendingVisual).toBe(incoming);
		expect(oldVisual.container.destroyed).toBe(false);
		expect(oldVisual.container.alpha).toBe(1);
		expect(incoming.container.alpha).toBe(0);
		expect(harness.animations.some(({ channel }) => channel === "visual-mix")).toBe(false);

		Effect.runSync(
			runVisualReadinessFx({
				generation: incoming.textureGeneration,
				kind: "complete",
				visual: incoming,
			}),
		);
		const mix = harness.animations.find(({ channel }) => channel === "visual-mix");
		expect(mix).toMatchObject({
			actor,
			channel: "visual-mix",
			durationMs: replacementCrossfadeDurationMs,
			incoming: incoming.container,
			ownerKey: "replacement:2:0:replacement",
		});
		expect(mix?.channel === "visual-mix" ? mix.outgoing.alpha : null).toBe(1);
		expect(oldVisual.container.destroyed).toBe(false);

		mix?.onComplete?.();
		expect(actor.currentVisual).toBe(incoming);
		expect(actor.pendingVisual).toBeNull();
		expect(incoming.container.alpha).toBe(1);
		expect(oldVisual.container.destroyed).toBe(true);
		expect(actor.visuals).toEqual(
			new Set([
				incoming,
			]),
		);
		expect(harness.animations.find(({ channel }) => channel === "crowd-opacity")).toMatchObject(
			{
				actor,
				channel: "crowd-opacity",
				durationMs: 180,
				ownerKey: `running:${actor.item.id}`,
				toCrowdAlpha: 0.82,
			},
		);
		expect(
			harness.animations.find(({ channel }) => channel === "activity-particles"),
		).toMatchObject({
			actor,
			channel: "activity-particles",
			curve: {
				kind: "linear",
			},
			durationMs: 1_760,
			ownerKey: `activity-particles:${actor.instanceId}`,
			repeat: Number.POSITIVE_INFINITY,
		});
	});
	it("cannot resurrect rapid replacement visuals after the canonical actor exits", () => {
		const first = createItem("runtime:producer", boardLocation, {
			revision: "revision:first",
			sourceUrl: "resource:first",
		});
		const second = createItem(first.id, boardLocation, {
			revision: "revision:second",
			sourceUrl: "resource:second",
		});
		const third = createItem(first.id, boardLocation, {
			revision: "revision:third",
			sourceUrl: "resource:third",
		});
		const actor = createActor(first);
		const harness = createReconcilerHarness({
			actor,
		});

		projectionState.main = [
			second,
		];
		projectionState.replacements = [
			{
				actorId: first.id,
				key: "2:0:replacement",
				previous: {
					itemId: first.itemId,
					sourceUrl: first.sourceUrl,
					title: first.title,
				},
				previousQuantity: first.quantity,
			},
		];
		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));
		const pendingSecond = createdVisualState.created[0] as ActorVisual;

		projectionState.main = [
			third,
		];
		projectionState.replacements = [
			{
				actorId: first.id,
				key: "3:0:replacement",
				previous: {
					itemId: second.itemId,
					sourceUrl: second.sourceUrl,
					title: second.title,
				},
				previousQuantity: second.quantity,
			},
		];
		Effect.runSync(harness.reconciler.reconcileFx(transition(3)));
		const pendingThird = createdVisualState.created[1] as ActorVisual;
		expect(actor.pendingVisual).toBe(pendingThird);

		projectionState.main = [];
		projectionState.replacements = [];
		Effect.runSync(harness.reconciler.reconcileFx(transition(4)));
		const exit = harness.animations.find(
			(animation) => animation.channel === "lifecycle-opacity" && animation.toAlpha === 0,
		);
		expect(harness.actors.has(first.id)).toBe(false);
		expect(harness.canceledActors).toEqual([
			actor,
		]);

		Effect.runSync(
			runVisualReadinessFx({
				generation: pendingSecond.textureGeneration,
				kind: "complete",
				visual: pendingSecond,
			}),
		);
		Effect.runSync(
			runVisualReadinessFx({
				generation: pendingThird.textureGeneration,
				kind: "complete",
				visual: pendingThird,
			}),
		);
		expect(harness.animations.some(({ channel }) => channel === "visual-mix")).toBe(false);
		expect(actor.currentVisual.item.revision).toBe("revision:first");

		exit?.onComplete?.();
		expect(actor.container.destroyed).toBe(true);
		expect(actor.visuals.size).toBe(0);
		expect(pendingSecond.container.destroyed).toBe(true);
		expect(pendingThird.container.destroyed).toBe(true);

		Effect.runSync(
			runVisualReadinessFx({
				generation: pendingThird.textureGeneration - 1,
				kind: "complete",
				visual: pendingThird,
			}),
		);
		expect(actor.container.destroyed).toBe(true);
		expect(harness.actors.has(first.id)).toBe(false);
	});
});
