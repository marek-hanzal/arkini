// @vitest-environment jsdom

import { Effect } from "effect";
import { Container } from "pixi.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createMainCameraFx } from "~/game-scene/fx/createMainCameraFx";
import { readMainLayoutFn } from "~/game-scene/fn/readMainLayoutFn";
import type { PixiApplicationOwner } from "~/tile-rendering/service/PixiApplicationOwner";
import type { MainDragController } from "~/tile-interaction/fx/createMainDragControllerFx";

const cleanup: Array<() => void> = [];
afterEach(() => {
	for (const closeFn of cleanup.splice(0)) closeFn();
});

const mountFn = () => {
	const canvas = document.createElement("canvas");
	document.body.append(canvas);
	let captured: number | null = null;
	canvas.setPointerCapture = (id) => {
		captured = id;
	};
	canvas.hasPointerCapture = (id) => captured === id;
	canvas.releasePointerCapture = () => {
		captured = null;
	};
	vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
		left: 20,
		top: 40,
		width: 1000,
		height: 800,
	} as DOMRect);
	const stage = new Container();
	const cancelFn = vi.fn();
	const blockFn = vi.fn();
	const screen = {
		width: 1000,
		height: 800,
	};
	let resizeFn = () => {};
	const camera = Effect.runSync(
		createMainCameraFx({
			dragThreshold: 5,
			application: {
				app: {
					canvas,
					screen,
				},
				stage,
				frames: {
					invalidateFx: Effect.void,
				},
				addResizeListenerFx: (listenerFn: () => void) =>
					Effect.sync(() => {
						resizeFn = listenerFn;
						return () => {
							resizeFn = () => {};
						};
					}),
			} as unknown as PixiApplicationOwner,
			drag: {
				cancelInteractionFx: Effect.sync(cancelFn),
				setInteractionBlockedFx: (blocked: boolean) => Effect.sync(() => blockFn(blocked)),
			} as unknown as MainDragController,
			layout: readMainLayoutFn({
				boardHeight: 3,
				boardWidth: 4,
				toolbarSize: 2,
				fixedCellSize: 512,
				width: 1000,
				height: 800,
			}),
		}),
	);
	cleanup.push(() => {
		Effect.runSync(camera.closeFx);
		canvas.remove();
		stage.destroy();
	});
	const pointerFn = (type: string, x: number, y: number, button = 2) => {
		const event = new MouseEvent(type, {
			bubbles: true,
			cancelable: true,
			clientX: x,
			clientY: y,
			button,
		});
		Object.defineProperties(event, {
			pointerId: {
				value: 1,
			},
			isPrimary: {
				value: true,
			},
		});
		canvas.dispatchEvent(event);
	};
	const wheelFn = () =>
		canvas.dispatchEvent(
			new WheelEvent("wheel", {
				clientX: 320,
				clientY: 240,
				deltaY: -200,
				cancelable: true,
			}),
		);
	return {
		camera,
		stage,
		screen,
		canvas,
		blockFn,
		cancelFn,
		pointerFn,
		wheelFn,
		resizeFn: () => resizeFn(),
	};
};

describe("main camera", () => {
	it("resets the shared game/editor camera with 0 while respecting text fields and overlays", () => {
		const mounted = mountFn();
		const initial = {
			x: mounted.stage.x,
			y: mounted.stage.y,
			scale: mounted.stage.scale.x,
		};
		mounted.wheelFn();
		mounted.pointerFn("pointerdown", 100, 100);
		mounted.pointerFn("pointermove", 200, 200);
		window.dispatchEvent(
			new KeyboardEvent("keydown", {
				key: "0",
				cancelable: true,
			}),
		);
		expect({
			x: mounted.stage.x,
			y: mounted.stage.y,
			scale: mounted.stage.scale.x,
		}).toEqual(initial);
		mounted.pointerFn("pointermove", 300, 300);
		expect(mounted.stage.x).toBe(initial.x);
		mounted.wheelFn();
		const zoom = mounted.stage.scale.x;
		const input = document.createElement("input");
		mounted.canvas.parentElement?.append(input);
		input.dispatchEvent(
			new KeyboardEvent("keydown", {
				key: "0",
				bubbles: true,
			}),
		);
		input.remove();
		expect(mounted.stage.scale.x).toBe(zoom);
		Effect.runSync(mounted.camera.setInteractionBlockedFx(true));
		window.dispatchEvent(
			new KeyboardEvent("keydown", {
				key: "0",
			}),
		);
		expect(mounted.stage.scale.x).toBe(zoom);
	});

	it("lets short right clicks reach tiles but claims a right drag before tile activation", () => {
		const mounted = mountFn();
		const tileDownFn = vi.fn();
		const tileUpFn = vi.fn();
		mounted.canvas.addEventListener("pointerdown", tileDownFn);
		mounted.canvas.addEventListener("pointerup", tileUpFn);
		const x = mounted.stage.x;
		mounted.pointerFn("pointerdown", 100, 100, 2);
		mounted.pointerFn("pointermove", 102, 100, 2);
		mounted.pointerFn("pointerup", 102, 100, 2);
		expect(tileDownFn).toHaveBeenCalledOnce();
		expect(tileUpFn).toHaveBeenCalledOnce();
		expect(mounted.stage.x).toBe(x);
		mounted.pointerFn("pointerdown", 100, 100, 2);
		mounted.pointerFn("pointermove", 150, 120, 2);
		expect(mounted.blockFn).toHaveBeenLastCalledWith(true);
		mounted.pointerFn("pointerup", 170, 120, 2);
		expect(mounted.stage.x).toBe(x + 70);
		expect(tileUpFn).toHaveBeenCalledOnce();
		expect(mounted.blockFn).toHaveBeenLastCalledWith(false);
	});

	it("anchors zoom at the pointer and preserves world framing through resize", () => {
		const mounted = mountFn();
		const before = mounted.stage.toLocal({
			x: 300,
			y: 200,
		});
		const originalScale = mounted.stage.scale.x;
		mounted.wheelFn();
		expect(mounted.stage.scale.x).toBeGreaterThan(originalScale);
		const after = mounted.stage.toLocal({
			x: 300,
			y: 200,
		});
		expect(after.x).toBeCloseTo(before.x);
		expect(after.y).toBeCloseTo(before.y);
		expect(mounted.cancelFn).toHaveBeenCalledOnce();
		const center = mounted.stage.toLocal({
			x: 500,
			y: 400,
		});
		const scale = mounted.stage.scale.x;
		mounted.screen.width = 1200;
		mounted.resizeFn();
		expect(mounted.stage.scale.x).toBe(scale);
		expect(
			mounted.stage.toLocal({
				x: 600,
				y: 400,
			}).x,
		).toBeCloseTo(center.x);
	});

	it("releases right-drag on blur, overlays and teardown", () => {
		const mounted = mountFn();
		const x = mounted.stage.x;
		mounted.pointerFn("pointerdown", 100, 100, 0);
		mounted.pointerFn("pointermove", 150, 120, 0);
		expect(mounted.stage.x).toBe(x);
		mounted.pointerFn("pointerdown", 100, 100);
		mounted.pointerFn("pointermove", 150, 120);
		expect(mounted.stage.x).toBe(x + 50);
		window.dispatchEvent(new Event("blur"));
		mounted.pointerFn("pointermove", 250, 120);
		expect(mounted.stage.x).toBe(x + 50);
		expect(mounted.blockFn).toHaveBeenLastCalledWith(false);
		Effect.runSync(mounted.camera.setInteractionBlockedFx(true));
		const scale = mounted.stage.scale.x;
		mounted.wheelFn();
		mounted.pointerFn("pointerdown", 100, 100);
		mounted.pointerFn("pointermove", 250, 120);
		expect(mounted.stage.x).toBe(x + 50);
		expect(mounted.stage.scale.x).toBe(scale);
		Effect.runSync(mounted.camera.closeFx);
		mounted.wheelFn();
		expect(mounted.stage.scale.x).toBe(scale);
	});
});
