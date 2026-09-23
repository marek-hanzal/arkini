import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { GameTransition } from "~/game-session/type/GameSession";

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

		const firstFrames: Array<{
			alpha: number;
			x: number;
			y: number;
		}> = [];
		harness.transientActorLayer.on("childAdded", (child) => {
			firstFrames.push({
				alpha: child.alpha,
				x: child.x,
				y: child.y,
			});
		});
		Effect.runSync(harness.reconciler.reconcileFx(transition(2, events)));
		expect(firstFrames).toEqual([
			{
				alpha: 0,
				x: 120,
				y: 140,
			},
			{
				alpha: 0,
				x: 120,
				y: 140,
			},
		]);

		expect(producerActor.container.destroyed).toBe(false);
		expect(harness.arrivals).toHaveLength(2);
		// No physical pose tween exists while artwork is pending; the request still owns position.
		for (let sequence = 3; sequence <= 10; sequence++) {
			Effect.runSync(harness.reconciler.reconcileFx(transition(sequence)));
			Effect.runSync(harness.reconciler.hydrateFx(transition(sequence)));
		}
		for (const flight of harness.arrivals) {
			expect({
				x: flight.actor.container.x,
				y: flight.actor.container.y,
			}).toEqual({
				x: 120,
				y: 140,
			});
			expect(flight.actor.container.parent).toBe(harness.transientActorLayer);
			flight.onCompleteFn?.();
			expect(flight.actor.container.parent).toBe(harness.layer);
		}
	});
	it("flies an originated output even when another actor leaves its destination", () => {
		const origin = createItem("runtime:origin", boardLocation);
		const destination = {
			...boardLocation,
			position: {
				x: 1,
				y: 0,
			},
		};
		const outgoing = createItem("runtime:outgoing", destination);
		const output = createItem("runtime:output", destination);
		const harness = createReconcilerHarness({
			actor: createActor(origin),
		});
		Effect.runSync(harness.store.setActorFx(createActor(outgoing)));
		projectionState.main = [
			output,
		];

		Effect.runSync(
			harness.reconciler.reconcileFx(
				transition(2, [
					{
						type: GameEventEnumSchema.enum.ItemSpawned,
						itemId: output.id,
						itemUid: output.itemUid,
						originItemId: origin.id,
						location: destination,
					},
				]),
			),
		);

		expect(harness.arrivals).toHaveLength(1);
		expect(harness.arrivals[0]?.origin).toMatchObject({
			x: 40,
			y: 60,
		});
		expect(harness.crossfades).toEqual([]);
		expect(harness.disappears).toHaveLength(2);
	});
	it("flies an item placed from storage when its origin is visible", () => {
		const origin = createItem("runtime:origin", boardLocation);
		const destination = {
			...boardLocation,
			position: {
				x: 2,
				y: 0,
			},
		};
		const placed = createItem("runtime:placed", destination);
		const harness = createReconcilerHarness({
			actor: createActor(origin),
		});
		projectionState.main = [
			origin,
			placed,
		];

		Effect.runSync(
			harness.reconciler.reconcileFx(
				transition(2, [
					{
						type: GameEventEnumSchema.enum.ItemPlaced,
						itemId: placed.id,
						itemUid: placed.itemUid,
						originItemId: origin.id,
						previousLocation: {
							scope: "input",
							ownerItemId: origin.id,
							lineId: "line:input",
							inputIndex: 0,
						},
						location: destination,
					},
				]),
			),
		);

		expect(harness.arrivals).toHaveLength(1);
		expect(harness.arrivals[0]?.actor.item.id).toBe(placed.id);
		expect(harness.appears).toEqual([]);
	});
	it("keeps an originated actor noninteractive when it departs mid-flight", () => {
		const origin = createItem("runtime:origin", boardLocation);
		const output = createItem("runtime:output", {
			...boardLocation,
			position: {
				x: 1,
				y: 0,
			},
		});
		const harness = createReconcilerHarness({
			actor: createActor(origin),
		});
		projectionState.main = [
			origin,
			output,
		];
		Effect.runSync(
			harness.reconciler.reconcileFx(
				transition(2, [
					{
						type: GameEventEnumSchema.enum.ItemSpawned,
						itemId: output.id,
						itemUid: output.itemUid,
						originItemId: origin.id,
						location: output.location,
					},
				]),
			),
		);
		const outputActor = harness.actors.get(output.id);
		expect(outputActor?.container.eventMode).toBe("none");
		projectionState.main = [
			origin,
		];
		Effect.runSync(harness.reconciler.reconcileFx(transition(3)));
		expect(outputActor?.container.eventMode).toBe("none");
	});
	it("pulls an admitted autofill source toward its live owner", () => {
		const source = createItem("runtime:source", boardLocation);
		const ownerLocation = {
			...boardLocation,
			position: {
				x: 1,
				y: 0,
			},
		};
		const owner = createItem("runtime:owner", ownerLocation);
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
		const runtimeItem = (item: typeof source, location: unknown) =>
			({
				id: item.id,
				item: {
					uid: item.itemUid,
				},
				location,
				revision: item.revision,
			}) as GameTransition["runtime"]["items"][number];
		const previousItems = [
			runtimeItem(source, source.location),
			runtimeItem(owner, owner.location),
		];
		const items = [
			runtimeItem(source, {
				scope: "delivery",
				phase: "outbound",
				origin: boardLocation,
				target: {
					kind: "line-input",
					ownerItemId: owner.id,
					lineId: "line:input",
					inputIndex: 0,
				},
			}),
			runtimeItem(owner, owner.location),
		];

		Effect.runSync(
			harness.reconciler.reconcileFx(
				transition(2, [], {
					previousItems,
					items,
				}),
			),
		);

		expect(harness.travels).toHaveLength(1);
		expect(harness.travels[0]?.actor).toBe(sourceActor);
		expect(harness.disappears).toEqual([]);
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
	it("retires an autofill flight before the same identity returns to the Board", () => {
		const source = createItem("runtime:quick-return", boardLocation);
		const owner = createItem("runtime:owner", {
			...boardLocation,
			position: {
				x: 1,
				y: 0,
			},
		});
		const sourceActor = createActor(source);
		const harness = createReconcilerHarness({
			actor: sourceActor,
		});
		Effect.runSync(harness.store.setActorFx(createActor(owner)));
		projectionState.main = [
			owner,
		];
		const runtimeItem = (location: unknown) =>
			({
				id: source.id,
				item: {
					uid: source.itemUid,
				},
				location,
				revision: source.revision,
			}) as GameTransition["runtime"]["items"][number];
		Effect.runSync(
			harness.reconciler.reconcileFx(
				transition(2, [], {
					previousItems: [
						runtimeItem(boardLocation),
					],
					items: [
						runtimeItem({
							scope: "delivery",
							phase: "outbound",
							origin: boardLocation,
							target: {
								kind: "line-input",
								ownerItemId: owner.id,
							},
						}),
						{
							id: owner.id,
							item: {
								uid: owner.itemUid,
							},
							location: owner.location,
						} as GameTransition["runtime"]["items"][number],
					],
				}),
			),
		);
		expect(harness.travels).toHaveLength(1);
		projectionState.main = [
			owner,
			source,
		];
		Effect.runSync(harness.reconciler.reconcileFx(transition(3)));

		expect(sourceActor.container.destroyed).toBe(true);
		expect(harness.canceledActors).toContain(sourceActor);
		expect(harness.actors.get(source.id)).not.toBe(sourceActor);
		harness.travels[0]?.onCompleteFn?.();
		expect(harness.disappears).toEqual([]);
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

		Effect.runSync(
			harness.reconciler.reconcileFx(
				transition(2, [
					{
						type: GameEventEnumSchema.enum.ItemSpawned,
						itemId: output.id,
						itemUid: output.itemUid,
						originItemId: consumed.id,
						location: boardLocation,
					},
				]),
			),
		);

		const incoming = harness.actors.get(output.id);
		expect(harness.crossfades).toHaveLength(1);
		expect(harness.crossfades[0]).toMatchObject({
			incoming,
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
