import { describe, expect, it } from "vitest";
import { Effect } from "effect";

import {
	boardLocation,
	createActor,
	createItem,
	createReconcilerHarness,
	__fixture_createdVisualState as createdVisualState,
	inventoryLocation,
	projectionProbeState as projectionState,
	transition,
} from "./createMainReconcilerFx.test/fixture";

describe("main reconciliation / snapshot ownership", () => {
	it("applies same-frame add, update, and removal from one classified snapshot", () => {
		const previous = createItem("runtime:update", boardLocation);
		const current = createItem(previous.id, boardLocation, {
			quantity: 4,
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
		projectionState.inventory = [
			createItem(removed.id, inventoryLocation),
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
			quantity: 5,
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
