// @vitest-environment jsdom

import { Effect } from "effect";
import { Container } from "pixi.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createBoardCameraFx } from "~/game-scene/fx/createBoardCameraFx";
import { readMainLayoutFn } from "~/game-scene/fn/readMainLayoutFn";
import type { PixiApplicationOwner } from "~/tile-rendering/service/PixiApplicationOwner";
import { readInventoryLayoutFn } from "~/game-scene/fn/readInventoryLayoutFn";
import type { SurfaceLayout } from "~/game-scene/type/SceneLayout";

const cleanup: Array<() => void> = [];
afterEach(() => {
	for (const closeFn of cleanup.splice(0)) closeFn();
});

const mountFn = (
	surfaces: readonly [
		SurfaceLayout,
		...SurfaceLayout[],
	],
	canStartLeftPanFn?: (x: number, y: number) => boolean,
) => {
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
	const refreshPointerFn = vi.fn();
	const blockFn = vi.fn();
	const screen = {
		width: 1000,
		height: 800,
	};
	let resizeFn = () => {};
	const edgeFrames = new Set<() => void>();
	const camera = Effect.runSync(
		createBoardCameraFx({
			canStartLeftPanFx:
				canStartLeftPanFn === undefined
					? undefined
					: (x, y) => Effect.sync(() => canStartLeftPanFn(x, y)),
			dragThreshold: 5,
			application: {
				app: {
					canvas,
					screen,
				},
				stage,
				frames: {
					invalidateFx: Effect.void,
					scheduleFx: (workFn: () => void) =>
						Effect.sync(() => {
							edgeFrames.add(workFn);
							return () => {
								edgeFrames.delete(workFn);
							};
						}),
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
				refreshPointerFx: (pointer) => Effect.sync(() => refreshPointerFn(pointer)),
				setInteractionBlockedFx: (blocked: boolean) => Effect.sync(() => blockFn(blocked)),
			},
			surfaces,
		}),
	);
	cleanup.push(() => {
		Effect.runSync(camera.closeFx);
		canvas.remove();
		stage.destroy();
	});
	const pointerFn = (type: string, x: number, y: number, button = 2, buttons = 0) => {
		const event = new MouseEvent(type, {
			bubbles: true,
			cancelable: true,
			clientX: x,
			clientY: y,
			button,
			buttons,
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
		edgeFrames,
		frameFn: () => {
			const callbacks = [
				...edgeFrames,
			];
			edgeFrames.clear();
			for (const callbackFn of callbacks) callbackFn();
		},
		stage,
		screen,
		canvas,
		blockFn,
		cancelFn,
		refreshPointerFn,
		pointerFn,
		wheelFn,
		resizeFn: () => resizeFn(),
	};
};

const mainLayout = readMainLayoutFn({
	boardHeight: 3,
	boardWidth: 4,
	toolbarSize: 2,
	fixedCellSize: 512,
	width: 1000,
	height: 800,
});
const cases: Array<{
	name: string;
	surfaces: readonly [
		SurfaceLayout,
		...SurfaceLayout[],
	];
}> = [
	{
		name: "Board + Toolbar",
		surfaces: [
			mainLayout.board,
			mainLayout.toolbar!,
		],
	},
	{
		name: "Inventory",
		surfaces: [
			readInventoryLayoutFn({
				columns: 5,
				rows: 4,
			}).surface,
		],
	},
];
describe.each(cases)("$name camera", ({ surfaces }) => {
	it("resets the shared game/editor camera with 0 while respecting text fields and overlays", () => {
		const mounted = mountFn(surfaces);
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

	it("admits left camera drag only from an empty cell using world coordinates", () => {
		const admitFn = vi.fn().mockReturnValue(false);
		const mounted = mountFn(surfaces, admitFn);
		mounted.stage.scale.set(0.5);
		mounted.stage.position.set(100, 200);
		mounted.pointerFn("pointerdown", 320, 340, 0, 1);
		expect(admitFn).toHaveBeenLastCalledWith(400, 200);
		mounted.pointerFn("pointermove", 350, 340, 0, 1);
		expect(mounted.stage.x).toBe(100);
		mounted.pointerFn("pointerup", 350, 340, 0);
		admitFn.mockReturnValue(true);
		mounted.pointerFn("pointerdown", 320, 340, 0, 1);
		mounted.pointerFn("pointermove", 350, 340, 0, 1);
		expect(mounted.stage.x).toBe(130);
		expect(mounted.blockFn).toHaveBeenLastCalledWith(true);
		mounted.pointerFn("pointerup", 360, 340, 0);
		expect(mounted.stage.x).toBe(140);
		expect(mounted.blockFn).toHaveBeenLastCalledWith(false);
	});

	it("lets short right clicks reach tiles but claims a right drag before tile activation", () => {
		const mounted = mountFn(surfaces);
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
		const mounted = mountFn(surfaces);
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
		const mounted = mountFn(surfaces);
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

describe("Board edge navigation", () => {
	it("continues without pointer movement and stops on overlays, pointer exit, blur and teardown", () => {
		const mounted = mountFn([
			mainLayout.board,
			mainLayout.toolbar!,
		]);
		mounted.stage.scale.set(1);
		mounted.stage.position.set(0, 0);
		mounted.pointerFn("pointermove", 1010, 440, 0);
		expect(mounted.edgeFrames.size).toBe(1);
		mounted.frameFn();
		const first = mounted.stage.x;
		expect(first).toBeLessThan(0);
		mounted.frameFn();
		expect(mounted.stage.x).toBeLessThan(first);
		Effect.runSync(mounted.camera.setInteractionBlockedFx(true));
		expect(mounted.edgeFrames.size).toBe(0);
		Effect.runSync(mounted.camera.setInteractionBlockedFx(false));
		mounted.pointerFn("pointermove", 1010, 440, 0);
		mounted.canvas.dispatchEvent(new Event("pointerleave"));
		expect(mounted.edgeFrames.size).toBe(0);
		mounted.pointerFn("pointermove", 1010, 440, 0);
		window.dispatchEvent(new Event("blur"));
		expect(mounted.edgeFrames.size).toBe(0);
		mounted.pointerFn("pointermove", 1010, 440, 0);
		Effect.runSync(mounted.camera.closeFx);
		expect(mounted.edgeFrames.size).toBe(0);
	});

	it("continues over the toolbar and enables navigation in overflowing inventory", () => {
		const mounted = mountFn([
			mainLayout.board,
			mainLayout.toolbar!,
		]);
		mounted.stage.scale.set(1);
		mounted.stage.position.set(990 - mainLayout.toolbar!.x, 100 - mainLayout.toolbar!.y);
		mounted.pointerFn("pointermove", 1015, 145, 0);
		expect(mounted.edgeFrames.size).toBe(1);
		const inventory = mountFn([
			readInventoryLayoutFn({
				columns: 5,
				rows: 4,
			}).surface,
		]);
		inventory.stage.scale.set(1);
		inventory.pointerFn("pointermove", 1010, 440, 0);
		expect(inventory.edgeFrames.size).toBe(1);
	});

	it("keeps scrolling down through the gap and past the Board-only limit", () => {
		const mounted = mountFn([
			mainLayout.board,
			mainLayout.toolbar!,
		]);
		mounted.stage.scale.set(1);
		const boardBottom = mainLayout.board.y + mainLayout.board.height;
		const gapMiddle = (boardBottom + mainLayout.toolbar!.y) / 2;
		mounted.stage.position.set(0, 790 - gapMiddle);
		mounted.pointerFn("pointermove", 520, 830, 0);
		expect(mounted.edgeFrames.size).toBe(1);
		const beforeGap = mounted.stage.y;
		mounted.frameFn();
		expect(mounted.stage.y).toBeLessThan(beforeGap);
		// The entire toolbar remains reachable beyond the old Board-only overscroll bound.
		mounted.stage.y = 800 - boardBottom - mainLayout.board.cellSize;
		const oldLimit = mounted.stage.y;
		mounted.frameFn();
		expect(mounted.stage.y).toBeLessThan(oldLimit);
	});

	it("keeps edge navigation active with a held item and refreshes its stationary pointer", () => {
		const mounted = mountFn([
			mainLayout.board,
			mainLayout.toolbar!,
		]);
		mounted.stage.scale.set(1);
		mounted.stage.position.set(0, 0);
		mounted.pointerFn("pointerdown", 1010, 440, 0, 1);
		mounted.pointerFn("pointermove", 1010, 440, 0, 1);
		expect(mounted.edgeFrames.size).toBe(1);
		mounted.frameFn();
		expect(mounted.stage.x).toBeLessThan(0);
		expect(mounted.refreshPointerFn).toHaveBeenLastCalledWith({
			pointerId: 1,
			x: 990,
			y: 400,
		});
		mounted.frameFn();
		expect(mounted.refreshPointerFn).toHaveBeenCalledTimes(2);
		mounted.pointerFn("pointerup", 1010, 440, 0);
		expect(mounted.edgeFrames.size).toBe(0);
	});

	it("does not run in fitted view and cancels before an item or camera drag", () => {
		const mounted = mountFn([
			mainLayout.board,
			mainLayout.toolbar!,
		]);
		mounted.pointerFn("pointermove", 1010, 440, 0);
		expect(mounted.edgeFrames.size).toBe(0);
		mounted.stage.scale.set(1);
		mounted.stage.position.set(0, 0);
		mounted.pointerFn("pointermove", 1010, 440, 0);
		expect(mounted.edgeFrames.size).toBe(1);
		mounted.pointerFn("pointerdown", 1010, 440, 0);
		expect(mounted.edgeFrames.size).toBe(0);
	});
});
