import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
	createItem,
	item,
	mountController,
	pointer,
	previewTestState as previewState,
} from "~test/tile-interaction/fx/MainDragController.test/fixture";

describe("main drag controller: preview", () => {
	it("derives neutral responders from engine previews before attracting the hovered target", () => {
		const eligible = createItem("runtime:eligible", 1);
		const invalid = createItem("runtime:invalid", 2);
		const mounted = mountController({
			targetItems: [
				eligible,
				invalid,
			],
		});
		previewState.actorKinds.set(eligible.id, "merge");
		previewState.actorKinds.set(invalid.id, "swap");
		mounted.setDropTargetX(3);
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.flushFrame();

		expect(mounted.magneticUpdates[0]?.attractedActorId).toBeNull();
		expect(Array.from(mounted.magneticUpdates[0]?.eligibleAttractionActorIds ?? [])).toEqual([
			eligible.id,
		]);

		mounted.setDropTargetX(1);
		mounted.setOccupant(eligible);
		mounted.setCommandTarget({
			kind: "slot",
			location: eligible.location,
			occupant: {
				itemId: eligible.id,
				revision: eligible.revision,
			},
		});
		mounted.stage.emit("globalpointermove", pointer(40, 20));
		mounted.flushFrame();

		expect(mounted.magneticUpdates[1]?.attractedActorId).toBe(eligible.id);
		expect(
			Array.from(mounted.magneticUpdates.at(-1)?.eligibleAttractionActorIds ?? []),
		).toEqual([
			eligible.id,
		]);
	});

	it("coalesces a stationary drag refresh when a compatible motion source enters", () => {
		const moving = createItem("runtime:moving", 8);
		const mounted = mountController({
			targetItems: [
				moving,
			],
		});
		previewState.actorKinds.set(moving.id, "merge");
		mounted.setLocalActorIds([]);
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.flushFrame();
		expect(previewState.readsByActorId.get(moving.id)).toBeUndefined();

		const targetReadCount = mounted.dropTargetReads.length;
		mounted.stage.emit("globalpointermove", pointer(35, 20));
		mounted.stage.emit("globalpointermove", pointer(40, 20));
		mounted.setActiveMagneticSourceActorIds([
			moving.id,
		]);
		mounted.triggerSourceMembership("motion");
		mounted.flushFrame();

		expect(mounted.dropTargetReads).toHaveLength(targetReadCount + 1);
		expect(previewState.readsByActorId.get(moving.id)).toBe(1);
		expect(
			Array.from(mounted.magneticUpdates.at(-1)?.eligibleAttractionActorIds ?? []),
		).toContain(moving.id);
	});

	it("requests a padded live-source neighborhood and always includes the exact target", () => {
		const eligible = createItem("runtime:eligible", 8);
		const moving = createItem("runtime:moving", 9);
		const mounted = mountController({
			targetItems: [
				eligible,
				moving,
			],
		});
		previewState.actorKinds.set(eligible.id, "merge");
		previewState.actorKinds.set(moving.id, "merge");
		mounted.setLocalActorIds([]);
		mounted.setActiveMagneticSourceActorIds([
			item.id,
			moving.id,
		]);
		mounted.setOccupant(eligible);
		mounted.setCommandTarget({
			kind: "slot",
			location: eligible.location,
			occupant: {
				itemId: eligible.id,
				revision: eligible.revision,
			},
		});

		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.flushFrame();

		expect(mounted.localActorReads).toEqual([
			{
				excludeActorId: item.id,
				height: 80,
				paddingRatio: 1.5,
				width: 80,
				x: 30,
				y: 20,
			},
		]);
		expect(mounted.magneticUpdates[0]?.candidateActorIds).toEqual([
			moving.id,
			eligible.id,
		]);
		expect(mounted.flushMagneticField).toHaveBeenCalledOnce();
	});

	it("caches positive and negative local eligibility, then prunes actors that leave", () => {
		const eligible = createItem("runtime:eligible", 1);
		const invalid = createItem("runtime:invalid", 2);
		const mounted = mountController({
			targetItems: [
				eligible,
				invalid,
			],
		});
		previewState.actorKinds.set(eligible.id, "merge");
		previewState.actorKinds.set(invalid.id, "swap");
		mounted.setLocalActorIds([
			eligible.id,
			invalid.id,
		]);
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));

		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.flushFrame();
		mounted.stage.emit("globalpointermove", pointer(31, 20));
		mounted.flushFrame();
		expect(previewState.readsByActorId.get(eligible.id)).toBe(1);
		expect(previewState.readsByActorId.get(invalid.id)).toBe(1);

		mounted.setLocalActorIds([
			invalid.id,
		]);
		mounted.stage.emit("globalpointermove", pointer(32, 20));
		mounted.flushFrame();
		mounted.setLocalActorIds([
			eligible.id,
		]);
		mounted.stage.emit("globalpointermove", pointer(33, 20));
		mounted.flushFrame();

		expect(previewState.readsByActorId.get(eligible.id)).toBe(2);
		expect(previewState.readsByActorId.get(invalid.id)).toBe(1);
	});

	it("does not cache a failed local eligibility preview", () => {
		const eligible = createItem("runtime:eligible", 1);
		const mounted = mountController({
			targetItems: [
				eligible,
			],
		});
		previewState.actorKinds.set(eligible.id, "merge");
		previewState.failureActorIds.add(eligible.id);
		mounted.setLocalActorIds([
			eligible.id,
		]);
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.flushFrame();
		expect(mounted.actor.dragging).toBe(false);
		expect(mounted.reportCriticalFailureFn).toHaveBeenCalledOnce();

		previewState.failureActorIds.delete(eligible.id);
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(31, 20));
		mounted.flushFrame();

		expect(previewState.readsByActorId.get(eligible.id)).toBe(2);
		expect(
			Array.from(mounted.magneticUpdates.at(-1)?.eligibleAttractionActorIds ?? []),
		).toEqual([
			eligible.id,
		]);
	});

	it("refreshes a stationary pointer target when its canonical identity changes", () => {
		const eligible = createItem("runtime:eligible", 1);
		const mounted = mountController({
			targetItems: [
				eligible,
			],
		});
		previewState.actorKinds.set(eligible.id, "merge");
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.flushFrame();
		expect(mounted.magneticUpdates[0]?.attractedActorId).toBeNull();

		mounted.setOccupant(eligible);
		mounted.setCommandTarget({
			kind: "slot",
			location: eligible.location,
			occupant: {
				itemId: eligible.id,
				revision: eligible.revision,
			},
		});
		Effect.runSync(mounted.controller.requestRefreshFx);
		mounted.flushFrame();

		expect(mounted.magneticUpdates[1]?.attractedActorId).toBe(eligible.id);
	});
});
