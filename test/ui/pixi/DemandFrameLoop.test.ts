// @vitest-environment jsdom

import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import { createDemandFrameLoopFx } from "~/ui/pixi/runtime/createDemandFrameLoopFx";

const createFakeFrames = () => {
	let nextId = 0;
	const callbacks = new Map<number, FrameRequestCallback>();
	return {
		callbacks,
		cancelFrame: (handle: number) => {
			callbacks.delete(handle);
		},
		requestFrame: (callback: FrameRequestCallback) => {
			const handle = ++nextId;
			callbacks.set(handle, callback);
			return handle;
		},
		runNext: (timestampMs: number) => {
			const entry = callbacks.entries().next().value as
				| readonly [
						number,
						FrameRequestCallback,
				  ]
				| undefined;
			if (entry === undefined) throw new Error("No frame is queued.");
			callbacks.delete(entry[0]);
			entry[1](timestampMs);
		},
	};
};

describe("DemandFrameLoop", () => {
	it("coalesces a burst of invalidations into one frame and one render", () => {
		const fake = createFakeFrames();
		const render = vi.fn();
		const loop = Effect.runSync(
			createDemandFrameLoopFx({
				cancelFrame: fake.cancelFrame,
				reportCriticalFailure: vi.fn(),
				render,
				requestFrame: fake.requestFrame,
			}),
		);

		for (let index = 0; index < 100; index += 1) Effect.runSync(loop.invalidateFx);
		expect(fake.callbacks).toHaveLength(1);
		fake.runNext(10);

		expect(render).toHaveBeenCalledOnce();
		expect(fake.callbacks).toHaveLength(0);
	});

	it("cancels queued work and cannot resurrect after close", () => {
		const fake = createFakeFrames();
		const render = vi.fn();
		const loop = Effect.runSync(
			createDemandFrameLoopFx({
				cancelFrame: fake.cancelFrame,
				reportCriticalFailure: vi.fn(),
				render,
				requestFrame: fake.requestFrame,
			}),
		);
		Effect.runSync(loop.invalidateFx);
		Effect.runSync(loop.closeFx);
		Effect.runSync(loop.invalidateFx);

		expect(fake.callbacks).toHaveLength(0);
		expect(render).not.toHaveBeenCalled();
	});

	it("poisons the loop after a renderer failure instead of spinning", () => {
		const fake = createFakeFrames();
		const reportCriticalFailure = vi.fn();
		const loop = Effect.runSync(
			createDemandFrameLoopFx({
				cancelFrame: fake.cancelFrame,
				reportCriticalFailure,
				render: () => {
					throw new Error("context lost");
				},
				requestFrame: fake.requestFrame,
			}),
		);
		Effect.runSync(loop.invalidateFx);
		fake.runNext(10);

		expect(reportCriticalFailure).toHaveBeenCalledOnce();
		Effect.runSync(loop.invalidateFx);
		expect(fake.callbacks).toHaveLength(0);
	});
});
