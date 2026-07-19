// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { waitForActiveViewTransition } from "~/ui/navigation/waitForActiveViewTransition";

const originalActiveViewTransition = Object.getOwnPropertyDescriptor(
	document,
	"activeViewTransition",
);
const originalRequestAnimationFrame = window.requestAnimationFrame;
const originalStartViewTransition = document.startViewTransition;

afterEach(() => {
	if (originalActiveViewTransition === undefined) {
		Reflect.deleteProperty(document, "activeViewTransition");
	} else {
		Object.defineProperty(document, "activeViewTransition", originalActiveViewTransition);
	}
	window.requestAnimationFrame = originalRequestAnimationFrame;
	document.startViewTransition = originalStartViewTransition;
	vi.restoreAllMocks();
});

describe("waitForActiveViewTransition", () => {
	const enableViewTransitions = () => {
		document.startViewTransition = vi.fn() as typeof document.startViewTransition;
	};

	it("waits for the native route transition before releasing heavy action work", async () => {
		enableViewTransitions();
		const frameCallbacks: FrameRequestCallback[] = [];
		window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
			frameCallbacks.push(callback);
			return frameCallbacks.length;
		});
		let finishTransition!: () => void;
		const finished = new Promise<void>((resolve) => {
			finishTransition = resolve;
		});
		Object.defineProperty(document, "activeViewTransition", {
			configurable: true,
			value: {
				finished,
			},
		});

		let completed = false;
		const waiting = waitForActiveViewTransition().then(() => {
			completed = true;
		});
		expect(frameCallbacks).toHaveLength(1);
		frameCallbacks.shift()?.(0);
		await Promise.resolve();
		expect(completed).toBe(false);

		finishTransition();
		await waiting;
		expect(completed).toBe(true);
	});

	it("stops looking after a few frames when no transition is active", async () => {
		enableViewTransitions();
		const frameCallbacks: FrameRequestCallback[] = [];
		window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
			frameCallbacks.push(callback);
			return frameCallbacks.length;
		});
		Object.defineProperty(document, "activeViewTransition", {
			configurable: true,
			value: null,
		});

		let completed = false;
		const waiting = waitForActiveViewTransition().then(() => {
			completed = true;
		});
		for (let frame = 0; frame < 3; frame += 1) {
			frameCallbacks.shift()?.(frame);
			await Promise.resolve();
		}
		await waiting;
		expect(completed).toBe(true);
		expect(window.requestAnimationFrame).toHaveBeenCalledTimes(3);
	});
});
