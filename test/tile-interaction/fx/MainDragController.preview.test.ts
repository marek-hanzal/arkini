import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createDragActor } from "~test/tile-interaction/fx/MainDragController.test/actors";

import {
	createItem,
	mountController,
	pointer,
	previewTestState as previewState,
} from "~test/tile-interaction/fx/MainDragController.test/fixture";

describe("main drag controller: preview", () => {
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
		expect(previewState.readsByActorId.get(eligible.id)).toBeUndefined();

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

		expect(previewState.readsByActorId.get(eligible.id)).toBe(1);
	});
});

describe("manual drop target feedback", () => {
	const target = createItem("runtime:target", 1);
	const mountTarget = () => {
		const mounted = mountController({
			targetItems: [
				target,
			],
		});
		mounted.setOccupant(target);
		mounted.setCommandTarget({
			kind: "slot",
			location: target.location,
			occupant: {
				itemId: target.id,
				revision: target.revision,
			},
		});
		previewState.actorKinds.set(target.id, "swap");
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.flushFrame();
		return mounted;
	};

	it("restores a nonaccepting target when a stationary drag becomes accepted", () => {
		const mounted = mountTarget();
		const targetActor = mounted.actors.get(target.id);
		expect(mounted.animations.filter(({ channel }) => channel === "drop-target")).toMatchObject(
			[
				{
					actor: targetActor,
					toFactor: 0.8,
				},
			],
		);
		mounted.stage.emit("globalpointermove", pointer(31, 20));
		mounted.flushFrame();
		expect(mounted.animations.filter(({ channel }) => channel === "drop-target")).toHaveLength(
			1,
		);

		const revised = {
			...target,
			revision: "revision:accepting",
		};
		mounted.setOccupant(revised);
		mounted.setCommandTarget({
			kind: "slot",
			location: revised.location,
			occupant: {
				itemId: revised.id,
				revision: revised.revision,
			},
		});
		previewState.actorKinds.set(target.id, "store-input");
		Effect.runSync(mounted.controller.requestRefreshFx);
		mounted.flushFrame();
		expect(mounted.animations.filter(({ channel }) => channel === "drop-target")).toMatchObject(
			[
				{
					actor: targetActor,
					toFactor: 0.8,
				},
				{
					actor: targetActor,
					toFactor: 1,
				},
			],
		);
		Effect.runSync(mounted.controller.closeFx);
	});

	it("restores the old target when the pointer leaves and never dims the dragged actor", () => {
		const mounted = mountTarget();
		mounted.setOccupant(mounted.actor.item);
		mounted.setCommandTarget({
			kind: "slot",
			location: mounted.actor.item.location,
			occupant: {
				itemId: mounted.actor.item.id,
				revision: mounted.actor.item.revision,
			},
		});
		previewState.kind = "reject";
		mounted.stage.emit("globalpointermove", pointer(40, 20));
		mounted.flushFrame();
		const feedback = mounted.animations.filter(({ channel }) => channel === "drop-target");
		expect(feedback).toHaveLength(2);
		expect(feedback.at(-1)).toMatchObject({
			actor: mounted.actors.get(target.id),
			toFactor: 1,
		});
		expect(feedback.some(({ actor }) => actor === mounted.actor)).toBe(false);
		Effect.runSync(mounted.controller.closeFx);
	});

	it.each([
		"release",
		"cancel",
		"overlay",
	] as const)("restores the target on %s", (ending) => {
		const mounted = mountTarget();
		switch (ending) {
			case "release":
				mounted.stage.emit("pointerup", pointer(30, 20));
				break;
			case "cancel":
				mounted.stage.emit("pointercancel", pointer(30, 20));
				break;
			case "overlay":
				Effect.runSync(mounted.controller.setInteractionBlockedFx(true));
				break;
		}
		expect(
			mounted.animations.filter(({ channel }) => channel === "drop-target").at(-1),
		).toMatchObject({
			actor: mounted.actors.get(target.id),
			toFactor: 1,
		});
		Effect.runSync(mounted.controller.closeFx);
	});

	it("resets the exact detached target and clears feedback during teardown", () => {
		const mounted = mountTarget();
		const oldTarget = mounted.actors.get(target.id)!;
		Effect.runSync(mounted.controller.detachActorFx(oldTarget));
		expect(mounted.presentationWrites.at(-1)).toMatchObject({
			actor: oldTarget,
			channel: "drop-target",
			factor: 1,
		});
		const replacement = createDragActor(target);
		mounted.actors.set(target.id, replacement);
		Effect.runSync(mounted.controller.requestRefreshFx);
		mounted.flushFrame();
		expect(
			mounted.animations.filter(({ channel }) => channel === "drop-target").at(-1),
		).toMatchObject({
			actor: replacement,
			toFactor: 0.8,
		});
		Effect.runSync(mounted.controller.closeFx);
		expect(
			mounted.presentationWrites.filter(({ channel }) => channel === "drop-target").at(-1),
		).toMatchObject({
			actor: replacement,
			factor: 1,
		});
	});
});
