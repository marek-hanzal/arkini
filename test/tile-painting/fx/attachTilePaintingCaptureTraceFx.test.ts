// @vitest-environment jsdom
import { Effect, Exit, Scope } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attachTilePaintingCaptureTraceFx } from "~/tile-painting/fx/attachTilePaintingCaptureTraceFx";

let scope: Scope.Closeable;
let owner: attachTilePaintingCaptureTraceFx.Output;
let parent: HTMLDivElement;
let viewport: HTMLDivElement;
let canvas: HTMLCanvasElement;
const records = vi.fn();
const pointerFn = (type: string, target: Element, pointerId = 7) => {
	const event = new MouseEvent(type, {
		bubbles: true,
		buttons: type === "pointerup" ? 0 : 1,
	});
	Object.defineProperties(event, {
		pointerId: {
			value: pointerId,
		},
		pointerType: {
			value: "mouse",
		},
	});
	target.dispatchEvent(event);
};

beforeEach(() => {
	records.mockReset();
	parent = document.createElement("div");
	viewport = document.createElement("div");
	canvas = document.createElement("canvas");
	viewport.append(canvas);
	parent.append(viewport);
	document.body.append(parent);
	let captured = false;
	Object.defineProperties(viewport, {
		setPointerCapture: {
			value: () => {
				captured = true;
			},
		},
		releasePointerCapture: {
			value: () => {
				captured = false;
			},
		},
		hasPointerCapture: {
			value: () => captured,
		},
	});
	scope = Effect.runSync(Scope.make());
	owner = Effect.runSync(
		attachTilePaintingCaptureTraceFx({
			viewportElement: viewport,
			canvas,
			trace: {
				recordFx: (event, data) =>
					Effect.sync(() => {
						records(event, data);
					}),
			},
		}).pipe(Effect.provideService(Scope.Scope, scope)),
	);
});
afterEach(() => {
	Effect.runSync(Scope.close(scope, Exit.void));
	document.body.replaceChildren();
});

describe("capture origin evidence", () => {
	it("orders raw release before painter callbacks and distinguishes capture transferred to another node", () => {
		const other = document.createElement("div");
		document.body.append(other);
		pointerFn("pointerdown", canvas);
		Effect.runSync(owner.setCaptureFx(7, "paint-start"));
		pointerFn("gotpointercapture", viewport);
		// A foreign capture target must be observable even though it is outside the painter.
		pointerFn("lostpointercapture", viewport);
		pointerFn("gotpointercapture", other);
		const handlerFn = () => Effect.runSync(owner.releaseCaptureFx(7, "pointer-up"));
		viewport.addEventListener("pointerup", handlerFn);
		pointerFn("pointerup", viewport);
		viewport.removeEventListener("pointerup", handlerFn);
		const calls = records.mock.calls;
		const inputs = calls.filter(([event]) => event === "capture-input").map(([, data]) => data);
		expect(inputs.map((data) => data.type)).toEqual([
			"pointerdown",
			"gotpointercapture",
			"lostpointercapture",
			"gotpointercapture",
			"pointerup",
		]);
		expect(inputs[1].target.nodeId).toBe(inputs[1].viewport.nodeId);
		expect(inputs[2].target.nodeId).toBe(inputs[1].target.nodeId);
		expect(inputs[3].target.nodeId).not.toBe(inputs[1].target.nodeId);
		expect(inputs[4]).toMatchObject({
			phase: 1,
			buttons: 0,
			pointerId: 7,
			pointerType: "mouse",
			trusted: false,
		});
		expect(
			calls.findIndex(
				([event, data]) => event === "capture-input" && data.type === "pointerup",
			),
		).toBeLessThan(
			calls.findIndex(
				([event, data]) => event === "capture-call" && data.operation === "release",
			),
		);
		expect(
			calls
				.filter(([event]) => event === "capture-returned")
				.map(([, data]) => [
					data.reason,
					data.captured,
				]),
		).toEqual([
			[
				"paint-start",
				true,
			],
			[
				"pointer-up",
				false,
			],
		]);
		const count = calls.length;
		pointerFn("gotpointercapture", other, 99);
		expect(records).toHaveBeenCalledTimes(count);
	});

	it("retains ancestor removal and reinsertion within one task before reporting a capture event", () => {
		pointerFn("pointerdown", canvas);
		Effect.runSync(owner.setCaptureFx(7, "paint-start"));
		parent.remove();
		document.body.append(parent);
		pointerFn("lostpointercapture", viewport);
		const calls = records.mock.calls;
		const changes = calls
			.filter(([event]) => event === "capture-dom-change")
			.map(([, data]) => data);
		expect(changes).toHaveLength(2);
		expect(changes[0].removed[0].nodeId).toBe(changes[1].added[0].nodeId);
		expect(changes[0].viewport.connected).toBe(true);
		expect(calls.findIndex(([event]) => event === "capture-dom-change")).toBeLessThan(
			calls.findIndex(
				([event, data]) => event === "capture-input" && data.type === "lostpointercapture",
			),
		);
	});

	it("drains pending DOM evidence on detach and removes every observer before the next attachment", async () => {
		pointerFn("pointerdown", canvas);
		canvas.remove();
		Effect.runSync(Scope.close(scope, Exit.void));
		expect(records.mock.calls.filter(([event]) => event === "capture-dom-change")).toHaveLength(
			1,
		);
		expect(records.mock.calls.at(-1)).toMatchObject([
			"capture-observer-detached",
			{
				canvas: {
					connected: false,
				},
				canvasInViewport: false,
			},
		]);
		const count = records.mock.calls.length;
		viewport.append(canvas);
		pointerFn("pointerup", viewport);
		window.dispatchEvent(new Event("blur"));
		document.dispatchEvent(new Event("visibilitychange"));
		await Promise.resolve();
		expect(records).toHaveBeenCalledTimes(count);
	});
});
