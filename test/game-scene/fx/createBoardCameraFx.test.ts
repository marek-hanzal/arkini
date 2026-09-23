// @vitest-environment jsdom

import { Effect } from "effect";
import { Container } from "pixi.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createBoardCameraFx } from "~/game-scene/fx/createBoardCameraFx";
import { readMainLayoutFn } from "~/game-scene/fn/readMainLayoutFn";
import type { PixiApplicationOwner } from "~/tile-rendering/service/PixiApplicationOwner";
import type { SurfaceLayout } from "~/game-scene/type/SceneLayout";

import type { AnimationDriver } from "~/tile-rendering/service/AnimationDriver";

const cleanup: Array<() => void> = [];
afterEach(() => {
	for (const closeFn of cleanup.splice(0)) closeFn();
});

const mountFn = (
	surfaces: readonly [
		SurfaceLayout,
		...SurfaceLayout[],
	],
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
	const tweens: Array<Parameters<AnimationDriver["startTweenFx"]>[0]> = [];
	const stopTweenFn = vi.fn();
	const camera = Effect.runSync(
		createBoardCameraFx({
			animationDriver: {
				startTweenFx: (props) =>
					Effect.sync(() => {
						tweens.push(props);
						return {
							stopFx: Effect.sync(stopTweenFn),
						};
					}),
			} as AnimationDriver,
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
		tweens,
		stopTweenFn,
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
});
const cases: Array<{
	name: string;
	surfaces: readonly [
		SurfaceLayout,
		...SurfaceLayout[],
	];
}> = [
	{
		name: "Board",
		surfaces: [
			mainLayout,
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

	it("leaves left-button gestures to item interaction without moving the camera", () => {
		const mounted = mountFn(surfaces);
		const before = {
			x: mounted.stage.x,
			y: mounted.stage.y,
		};
		mounted.blockFn.mockClear();
		mounted.pointerFn("pointerdown", 100, 100, 0, 1);
		mounted.pointerFn("pointermove", 150, 120, 0, 1);
		mounted.pointerFn("pointerup", 170, 120, 0);
		expect({
			x: mounted.stage.x,
			y: mounted.stage.y,
		}).toEqual(before);
		expect(mounted.blockFn).not.toHaveBeenCalled();
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
			mainLayout,
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

	it("keeps edge navigation active with a held item and refreshes its stationary pointer", () => {
		const mounted = mountFn([
			mainLayout,
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
			mainLayout,
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

it("refits the camera and reset bounds when the current board dimensions change", () => {
	const mounted = mountFn([
		mainLayout,
	]);
	const next = readMainLayoutFn({
		boardWidth: 2,
		boardHeight: 1,
	});
	Effect.runSync(
		mounted.camera.setSurfacesFx(
			[
				next,
			],
			{
				animate: true,
			},
		),
	);
	expect(mounted.tweens).toHaveLength(1);
	const tween = mounted.tweens[0]!;
	const previousScale = mounted.stage.scale.x;
	tween.onUpdateFn(0.5);
	expect(mounted.stage.scale.x).not.toBe(previousScale);
	tween.onUpdateFn(1);
	const expected = Math.min(1000 / (1024 + 256), 800 / (512 + 256), 1);
	expect(mounted.stage.scale.x).toBe(expected);
	expect(mounted.stage.x).toBe((1000 - 1024 * expected) / 2);
	expect(mounted.stage.y).toBe((800 - 512 * expected) / 2);
	mounted.wheelFn();
	const zoomedScale = mounted.stage.scale.x;
	tween.onUpdateFn(0);
	expect(mounted.stage.scale.x).toBe(zoomedScale);
	expect(mounted.stopTweenFn).toHaveBeenCalled();
	window.dispatchEvent(
		new KeyboardEvent("keydown", {
			key: "0",
		}),
	);
	expect(mounted.stage.scale.x).toBe(expected);
});

it("retargets size fitting from the live camera and retires callbacks on close", () => {
	const mounted = mountFn([
		mainLayout,
	]);
	const small = readMainLayoutFn({
		boardWidth: 2,
		boardHeight: 1,
	});
	Effect.runSync(
		mounted.camera.setSurfacesFx(
			[
				small,
			],
			{
				animate: true,
			},
		),
	);
	const first = mounted.tweens[0]!;
	first.onUpdateFn(0.4);
	const liveScale = mounted.stage.scale.x;
	Effect.runSync(
		mounted.camera.setSurfacesFx(
			[
				mainLayout,
			],
			{
				animate: true,
			},
		),
	);
	const second = mounted.tweens[1]!;
	first.onUpdateFn(1);
	expect(mounted.stage.scale.x).toBe(liveScale);
	second.onUpdateFn(0);
	expect(mounted.stage.scale.x).toBe(liveScale);
	Effect.runSync(mounted.camera.closeFx);
	second.onUpdateFn(1);
	expect(mounted.stage.scale.x).toBe(liveScale);
});
