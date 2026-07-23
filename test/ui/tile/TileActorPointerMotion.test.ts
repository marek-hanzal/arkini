// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useTileActorPointerMotion } from "~/ui/tile/useTileActorPointerMotion";
import { motionTestRuntime } from "~test/ui/support/motionReactMock";

vi.mock("motion/react", async () => import("~test/ui/support/motionReactMock"));

const roots: Array<ReturnType<typeof createRoot>> = [];
let pointerMotion: ReturnType<typeof useTileActorPointerMotion> | null = null;

const Capture = () => {
	pointerMotion = useTileActorPointerMotion();
	return null;
};

const renderPointerMotion = async () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => root.render(createElement(Capture)));
	if (pointerMotion === null) throw new Error("Pointer motion was not captured.");
	return pointerMotion;
};

beforeEach(() => {
	motionTestRuntime.reset();
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	vi.restoreAllMocks();
	document.body.replaceChildren();
	pointerMotion = null;
});

describe("useTileActorPointerMotion", () => {
	it("captures one explicit release snapshot and resets only after its handoff", async () => {
		const pointer = await renderPointerMotion();
		pointer.commands.armPickup({
			x: -20,
			y: 15,
		});
		pointer.commands.startPickup();
		pointer.values.direct.x.set(80);
		pointer.values.direct.y.set(-40);

		const snapshot = pointer.commands.release(12);

		expect(snapshot).toMatchObject({
			interactionGeneration: 12,
			direct: {
				x: 80,
				y: -40,
			},
			pickup: {
				x: -20,
				y: 15,
			},
			handoffOffset: {
				x: 60,
				y: -25,
			},
			visibleOffset: {
				x: 60,
				y: -25,
			},
		});
		expect(pointer.commands.resetAfterHandoff(snapshot.pointerGeneration)).toBe(true);
		expect(pointer.values.direct.x.get()).toBe(0);
		expect(pointer.values.direct.y.get()).toBe(0);
		expect(pointer.values.pickup.x.get()).toBe(0);
		expect(pointer.values.pickup.y.get()).toBe(0);
	});

	it("does not let a stale handoff clear a newer pointer generation", async () => {
		const pointer = await renderPointerMotion();
		pointer.commands.armPickup({
			x: 0,
			y: 0,
		});
		pointer.values.direct.x.set(40);
		const stale = pointer.commands.release(1);

		pointer.commands.armPickup({
			x: 0,
			y: 0,
		});
		pointer.values.direct.x.set(75);

		expect(pointer.commands.resetAfterHandoff(stale.pointerGeneration)).toBe(false);
		expect(pointer.values.direct.x.get()).toBe(75);
	});

	it("preserves a settling physical pose when a newer pickup is armed", async () => {
		const pointer = await renderPointerMotion();
		pointer.commands.armPickup({
			x: 0,
			y: 0,
		});
		const released = pointer.commands.release(1);
		pointer.values.physical.x.jump(4.864);
		pointer.values.physical.y.jump(-2.25);
		pointer.values.physical.rotation.jump(-1.311);

		pointer.commands.armPickup({
			x: -20,
			y: 10,
		});

		expect(pointer.commands.resetAfterHandoff(released.pointerGeneration)).toBe(false);
		expect(pointer.values.direct.x.get()).toBe(0);
		expect(pointer.values.direct.y.get()).toBe(0);
		expect(pointer.values.pickup.x.get()).toBe(0);
		expect(pointer.values.pickup.y.get()).toBe(0);
		expect(pointer.values.physical.x.get()).toBe(4.864);
		expect(pointer.values.physical.y.get()).toBe(-2.25);
		expect(pointer.values.physical.rotation.get()).toBe(-1.311);

		pointer.commands.disarmPickup();

		expect(pointer.values.physical.x.get()).toBe(4.864);
		expect(pointer.values.physical.y.get()).toBe(-2.25);
		expect(pointer.values.physical.rotation.get()).toBe(-1.311);
	});

	it("cancels pointer, pickup, and physical response together", async () => {
		const pointer = await renderPointerMotion();
		pointer.commands.armPickup({
			x: 10,
			y: -5,
		});
		pointer.commands.startPickup();
		pointer.values.direct.x.set(30);
		pointer.values.direct.y.set(20);
		pointer.commands.updateResponse({
			delta: {
				x: 7,
				y: 7,
			},
			velocity: {
				x: 0,
				y: 0,
			},
		});

		expect(pointer.values.physical.x.get()).not.toBe(0);
		expect(pointer.values.physical.y.get()).not.toBe(0);

		pointer.commands.cancel();

		expect(pointer.values.direct.x.get()).toBe(0);
		expect(pointer.values.direct.y.get()).toBe(0);
		expect(pointer.values.pickup.x.get()).toBe(0);
		expect(pointer.values.pickup.y.get()).toBe(0);
		expect(pointer.values.physical.x.get()).toBe(0);
		expect(pointer.values.physical.y.get()).toBe(0);
		expect(pointer.values.physical.rotation.get()).toBe(0);
	});

	it("hands the exact pointer pose to a terminal cue without resetting it", async () => {
		motionTestRuntime.autoCompleteImperativeAnimations = false;
		const pointer = await renderPointerMotion();
		pointer.commands.armPickup({
			x: -12,
			y: 7,
		});
		pointer.commands.startPickup();
		pointer.values.direct.x.set(48);
		pointer.values.direct.y.set(12);
		pointer.commands.updateResponse({
			delta: {
				x: 7,
				y: 3,
			},
			velocity: {
				x: 500,
				y: 180,
			},
		});
		const before = {
			direct: {
				x: pointer.values.direct.x.get(),
				y: pointer.values.direct.y.get(),
			},
			pickup: {
				x: pointer.values.pickup.x.get(),
				y: pointer.values.pickup.y.get(),
			},
			physical: {
				x: pointer.values.physical.x.get(),
				y: pointer.values.physical.y.get(),
				rotation: pointer.values.physical.rotation.get(),
			},
		};

		pointer.commands.handoffToTerminalCue();

		expect({
			direct: {
				x: pointer.values.direct.x.get(),
				y: pointer.values.direct.y.get(),
			},
			pickup: {
				x: pointer.values.pickup.x.get(),
				y: pointer.values.pickup.y.get(),
			},
			physical: {
				x: pointer.values.physical.x.get(),
				y: pointer.values.physical.y.get(),
				rotation: pointer.values.physical.rotation.get(),
			},
		}).toEqual(before);
	});
});
