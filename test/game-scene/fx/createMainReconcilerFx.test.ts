import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";

import {
	boardLocation,
	createActor,
	createItem,
	createReconcilerHarness,
	__fixture_createdVisualState as createdVisualState,
	projectionProbeState as projectionState,
	transition,
} from "./createMainReconcilerFx.test/fixture";

describe("main reconciliation / snapshot ownership", () => {
	it("applies same-frame add, update, and removal from the canonical snapshot", () => {
		const previous = createItem("runtime:update", boardLocation);
		const current = createItem(previous.id, boardLocation, {
			revision: "revision:update:4",
		});
		const removed = createItem("runtime:removed", boardLocation);
		const added = createItem("runtime:added", boardLocation);
		const harness = createReconcilerHarness({
			actor: createActor(previous),
		});
		Effect.runSync(harness.store.setActorFx(createActor(removed)));
		projectionState.main = [
			current,
			added,
		];

		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));

		expect([
			...harness.actors.keys(),
		]).toEqual([
			current.id,
			added.id,
		]);
		expect(harness.actors.get(current.id)?.item.revision).toBe(current.revision);
		expect(harness.actors.get(added.id)?.item).toEqual(added);
		expect(harness.requestRefresh).toHaveBeenCalledOnce();
	});
	it("retires a transported identity before placing it in another Space", () => {
		const previous = createItem("runtime:traveler", boardLocation);
		const destination = createItem(previous.id, {
			...boardLocation,
			space: 1,
		});
		const sourceActor = createActor(previous);
		const harness = createReconcilerHarness({
			actor: sourceActor,
			pose: {
				size: 80,
				x: 420,
				y: 340,
			},
		});
		projectionState.main = [
			destination,
		];

		Effect.runSync(harness.reconciler.boardArriveFx(transition(2)));

		const destinationActor = harness.actors.get(previous.id);
		expect(destinationActor).toBeDefined();
		expect(destinationActor).not.toBe(sourceActor);
		expect(sourceActor.container.destroyed).toBe(true);
		expect(harness.detached).toEqual([
			sourceActor,
		]);
		expect(destinationActor?.container.parent).toBe(harness.layer);
		expect(destinationActor?.container.position).toMatchObject({
			x: 420,
			y: 340,
		});
	});
	it("keeps a held actor at the pointer and places it after interaction ends", () => {
		const previous = createItem("runtime:held", boardLocation);
		const updated = createItem(previous.id, boardLocation, {
			revision: "revision:held:2",
		});
		const actor = createActor(previous);
		actor.dragging = true;
		actor.container.position.set(240, 130);
		const harness = createReconcilerHarness({
			actor,
			pose: {
				size: 80,
				x: 420,
				y: 340,
			},
		});
		projectionState.main = [
			updated,
		];

		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));
		expect(actor.container.position).toMatchObject({
			x: 240,
			y: 130,
		});
		expect(actor.item.revision).toBe(updated.revision);
		expect(harness.writes.filter(({ channel }) => channel === "pose")).toEqual([]);

		actor.dragging = false;
		Effect.runSync(harness.reconciler.reconcileFx(transition(3)));
		expect(actor.container.position).toMatchObject({
			x: 420,
			y: 340,
		});
		expect(actor.container.parent).toBe(harness.layer);
	});
	it("travels a committed move after its accepted drop releases the held pose", () => {
		const previous = createItem("runtime:held-move", boardLocation);
		const destination = {
			...boardLocation,
			position: {
				x: 1,
				y: 0,
			},
		};
		const target = createItem("runtime:held-target", destination);
		const targetActor = createActor(target);
		targetActor.dragging = true;
		targetActor.container.position.set(500, 200);
		const actor = createActor(previous);
		actor.dragging = true;
		actor.container.position.set(240, 130);
		const harness = createReconcilerHarness({
			actor,
			pose: {
				size: 80,
				x: 420,
				y: 340,
			},
		});
		Effect.runSync(harness.store.setActorFx(targetActor));
		projectionState.main = [
			createItem(previous.id, destination),
			createItem(target.id, {
				...boardLocation,
				position: {
					x: 2,
					y: 0,
				},
			}),
		];

		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));
		expect(actor.container.position).toMatchObject({
			x: 240,
			y: 130,
		});
		expect(harness.travels).toEqual([]);

		actor.dragging = false;
		Effect.runSync(harness.reconciler.hydrateFx(transition(2)));
		expect(harness.travels).toHaveLength(1);
		expect(actor.container.position).toMatchObject({
			x: 240,
			y: 130,
		});
		expect(actor.container.parent).toBe(harness.transientActorLayer);
		expect(harness.travels[0]?.readTargetFn()).toMatchObject({
			x: 500,
			y: 200,
		});
	});
	it("flies a consumed input toward the live dragged owner center", () => {
		const source = createItem("runtime:input", boardLocation);
		const owner = createItem("runtime:owner", {
			...boardLocation,
			position: {
				x: 1,
				y: 0,
			},
		});
		const sourceActor = createActor(source);
		sourceActor.container.pivot.set(10, 5);
		const ownerActor = createActor(owner);
		ownerActor.dragging = true;
		ownerActor.container.position.set(300, 160);
		ownerActor.container.pivot.set(20, 10);
		ownerActor.container.scale.set(1.25);
		const harness = createReconcilerHarness({
			actor: sourceActor,
		});
		Effect.runSync(harness.store.setActorFx(ownerActor));
		projectionState.main = [
			owner,
		];

		Effect.runSync(
			harness.reconciler.reconcileFx(
				transition(2, [
					{
						type: GameEventEnumSchema.enum.ItemInputStored,
						sourceItemId: source.id,
						itemUid: source.itemUid,
						previousSourceLocation: boardLocation,
						ownerItemId: owner.id,
						lineId: "line:input",
						inputIndex: 0,
					},
				]),
			),
		);

		expect(harness.disappears).toEqual([]);
		expect(harness.travels).toHaveLength(1);
		expect(harness.travels[0]?.actor).toBe(sourceActor);
		expect(sourceActor.container.destroyed).toBe(false);
		expect(harness.travels[0]?.readTargetFn()).toMatchObject({
			size: 100,
			x: 287.5,
			y: 153.75,
		});
		ownerActor.container.position.set(320, 180);
		expect(harness.travels[0]?.readTargetFn()).toMatchObject({
			x: 307.5,
			y: 173.75,
		});
		harness.travels[0]?.onCompleteFn?.();
		expect(harness.disappears).toHaveLength(1);
		expect(sourceActor.container.destroyed).toBe(false);
		harness.disappears[0]?.onCompleteFn?.();
		expect(sourceActor.container.destroyed).toBe(true);
	});
	it("flies multiple spawned outputs from a producer removed in the same commit", () => {
		const producer = createItem("runtime:producer", boardLocation);
		const first = createItem("runtime:first-output", {
			...boardLocation,
			position: {
				x: 1,
				y: 0,
			},
		});
		const second = createItem("runtime:second-output", {
			...boardLocation,
			position: {
				x: 2,
				y: 0,
			},
		});
		const producerActor = createActor(producer);
		producerActor.container.position.set(120, 140);
		const harness = createReconcilerHarness({
			actor: producerActor,
			pose: {
				size: 80,
				x: 420,
				y: 340,
			},
		});
		projectionState.main = [
			first,
			second,
		];
		const events = [
			first,
			second,
		].map((item) => ({
			type: GameEventEnumSchema.enum.ItemSpawned,
			itemId: item.id,
			itemUid: item.itemUid,
			originItemId: producer.id,
			location: item.location,
		}));

		Effect.runSync(harness.reconciler.reconcileFx(transition(2, events)));

		expect(producerActor.container.destroyed).toBe(false);
		expect(harness.travels).toHaveLength(2);
		for (const flight of harness.travels) {
			expect(flight.actor.container.position).toMatchObject({
				x: 120,
				y: 140,
			});
			expect(flight.actor.container.parent).toBe(harness.transientActorLayer);
			flight.onCompleteFn?.();
			expect(flight.actor.container.parent).toBe(harness.layer);
		}
	});
	it("crossfades a different identity committed into the same slot", () => {
		const consumed = createItem("runtime:producer", boardLocation);
		const output = createItem("runtime:output", boardLocation);
		const outgoing = createActor(consumed);
		const harness = createReconcilerHarness({
			actor: outgoing,
		});
		projectionState.main = [
			output,
		];

		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));

		const incoming = harness.actors.get(output.id);
		expect(harness.crossfades).toHaveLength(1);
		expect(harness.crossfades[0]).toMatchObject({
			incoming,
			initialIncoming: true,
			outgoing,
		});
		expect(harness.appears).toEqual([]);
		expect(harness.disappears).toEqual([]);
		expect(outgoing.container.destroyed).toBe(false);
		harness.crossfades[0]?.onCompleteFn?.();
		expect(outgoing.container.destroyed).toBe(true);
		expect(incoming?.container.destroyed).toBe(false);
	});
	it("retargets committed travel to a dragged former slot occupant", () => {
		const source = createItem("runtime:source", boardLocation);
		const destination = {
			...boardLocation,
			position: {
				x: 1,
				y: 0,
			},
		};
		const target = createItem("runtime:target", destination);
		const targetActor = createActor(target);
		targetActor.dragging = true;
		targetActor.container.position.set(240, 130);
		const sourceActor = createActor(source);
		sourceActor.container.pivot.set(10, 5);
		const harness = createReconcilerHarness({
			actor: sourceActor,
			pose: {
				size: 80,
				x: 420,
				y: 340,
			},
		});
		Effect.runSync(harness.store.setActorFx(targetActor));
		projectionState.main = [
			createItem(source.id, destination),
			createItem(target.id, {
				...boardLocation,
				position: {
					x: 2,
					y: 0,
				},
			}),
		];

		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));

		expect(harness.travels).toHaveLength(1);
		expect(harness.travels[0]?.readTargetFn()).toMatchObject({
			x: 250,
			y: 135,
		});
		targetActor.container.position.set(260, 150);
		expect(harness.travels[0]?.readTargetFn()).toMatchObject({
			x: 270,
			y: 155,
		});
		expect(targetActor.container.position).toMatchObject({
			x: 260,
			y: 150,
		});
	});
	it("replaces an active presentation travel when its canonical destination changes", () => {
		const source = createItem("runtime:source", boardLocation);
		const destination = {
			...boardLocation,
			position: {
				x: 2,
				y: 0,
			},
		};
		const target = createItem("runtime:target", destination);
		const targetActor = createActor(target);
		targetActor.dragging = true;
		targetActor.container.position.set(240, 130);
		const harness = createReconcilerHarness({
			actor: createActor(source),
		});
		Effect.runSync(harness.store.setActorFx(targetActor));
		projectionState.main = [
			createItem(source.id, {
				...boardLocation,
				position: {
					x: 1,
					y: 0,
				},
			}),
			target,
		];
		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));
		expect(harness.travels).toHaveLength(1);

		projectionState.main = [
			createItem(source.id, destination),
			createItem(target.id, {
				...boardLocation,
				position: {
					x: 3,
					y: 0,
				},
			}),
		];
		Effect.runSync(harness.reconciler.reconcileFx(transition(3)));

		expect(harness.travels).toHaveLength(2);
		expect(harness.travels[1]?.readTargetFn()).toMatchObject({
			x: 240,
			y: 130,
		});
	});
	it("keeps outgoing actors alive until the Board barrier", () => {
		const item = createItem("runtime:outgoing", boardLocation);
		const actor = createActor(item);
		const harness = createReconcilerHarness({
			actor,
		});

		Effect.runSync(harness.reconciler.exitVisibleItemsFx);

		expect(harness.disappears).toHaveLength(1);
		expect(harness.actors.get(item.id)).toBe(actor);
		expect(actor.container.destroyed).toBe(false);
	});
	it("does not allocate another actor for an identical repeated snapshot", () => {
		const previous = createItem("runtime:previous", boardLocation);
		const added = createItem("runtime:added", boardLocation);
		const harness = createReconcilerHarness({
			actor: createActor(previous),
		});
		projectionState.main = [
			added,
		];

		Effect.runSync(harness.reconciler.reconcileFx(transition(2)));
		const createdVisualCount = createdVisualState.created.length;
		const addedInstanceId = harness.actors.get(added.id)?.instanceId;
		Effect.runSync(harness.reconciler.reconcileFx(transition(3)));

		expect(createdVisualState.created).toHaveLength(createdVisualCount);
		expect(harness.actors.get(added.id)?.instanceId).toBe(addedInstanceId);
	});
	it("keeps a closed owner inert while a remounted owner reconciles the current snapshot", () => {
		const previous = createItem("runtime:remount", boardLocation);
		const current = createItem(previous.id, boardLocation, {
			revision: "revision:remount:5",
		});
		const closedHarness = createReconcilerHarness({
			actor: createActor(previous),
		});
		projectionState.main = [
			current,
		];

		Effect.runSync(closedHarness.reconciler.closeFx);
		Effect.runSync(closedHarness.reconciler.reconcileFx(transition(2)));
		expect(closedHarness.actors.get(previous.id)?.item.revision).toBe(previous.revision);

		const remountedHarness = createReconcilerHarness({
			actor: createActor(previous),
		});
		Effect.runSync(remountedHarness.reconciler.hydrateFx(transition(2)));
		expect(remountedHarness.actors.get(current.id)?.item.revision).toBe(current.revision);
	});
});
