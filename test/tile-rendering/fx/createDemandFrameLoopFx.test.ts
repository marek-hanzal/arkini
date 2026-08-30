// @vitest-environment jsdom

import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import { createDemandFrameLoopFx } from "~/tile-rendering/fx/createDemandFrameLoopFx";

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

	it("runs scheduled work once in the owned frame and supports exact cancellation", () => {
		const fake = createFakeFrames();
		const work = vi.fn();
		const canceledWork = vi.fn();
		const loop = Effect.runSync(
			createDemandFrameLoopFx({
				cancelFrame: fake.cancelFrame,
				reportCriticalFailure: vi.fn(),
				render: vi.fn(),
				requestFrame: fake.requestFrame,
			}),
		);

		Effect.runSync(loop.scheduleFx(work));
		const cancel = Effect.runSync(loop.scheduleFx(canceledWork));
		cancel();
		expect(fake.callbacks).toHaveLength(1);
		fake.runNext(10);

		expect(work).toHaveBeenCalledOnce();
		expect(canceledWork).not.toHaveBeenCalled();
	});

	it("runs post-render work only after the projected frame", () => {
		const fake = createFakeFrames();
		const order: string[] = [];
		const canceled = vi.fn();
		const loop = Effect.runSync(
			createDemandFrameLoopFx({
				cancelFrame: fake.cancelFrame,
				reportCriticalFailure: vi.fn(),
				render: () => order.push("projected"),
				requestFrame: fake.requestFrame,
			}),
		);

		const cancel = Effect.runSync(loop.scheduleAfterRenderFx(canceled));
		cancel();
		Effect.runSync(loop.scheduleAfterRenderFx(() => order.push("space-switch")));
		fake.runNext(10);

		expect(order).toEqual([
			"projected",
			"space-switch",
		]);
		expect(canceled).not.toHaveBeenCalled();
	});

	it("stops later callbacks from the same frame when an earlier callback closes it", () => {
		const fake = createFakeFrames();
		const laterWork = vi.fn();
		const loop = Effect.runSync(
			createDemandFrameLoopFx({
				cancelFrame: fake.cancelFrame,
				reportCriticalFailure: vi.fn(),
				render: vi.fn(),
				requestFrame: fake.requestFrame,
			}),
		);

		Effect.runSync(loop.scheduleFx(() => Effect.runSync(loop.closeFx)));
		Effect.runSync(loop.scheduleFx(laterWork));
		fake.runNext(10);

		expect(laterWork).not.toHaveBeenCalled();
	});

	it("honors cancellation of a later callback during the same frame", () => {
		const fake = createFakeFrames();
		const laterWork = vi.fn();
		const loop = Effect.runSync(
			createDemandFrameLoopFx({
				cancelFrame: fake.cancelFrame,
				reportCriticalFailure: vi.fn(),
				render: vi.fn(),
				requestFrame: fake.requestFrame,
			}),
		);
		let cancelLater = () => {};

		Effect.runSync(loop.scheduleFx(() => cancelLater()));
		cancelLater = Effect.runSync(loop.scheduleFx(laterWork));
		fake.runNext(10);

		expect(laterWork).not.toHaveBeenCalled();
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
