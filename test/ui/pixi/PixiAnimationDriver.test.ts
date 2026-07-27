import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createPixiAnimationDriverFx } from "~/ui/pixi/animation/createPixiAnimationDriverFx";
import type { DemandFrameLoop } from "~/ui/pixi/runtime/DemandFrameLoop";

interface FakeMotionValue {
	readonly destroy: ReturnType<typeof vi.fn>;
	readonly emit: (value: number) => void;
	readonly get: () => number;
	readonly isAnimating: () => boolean;
	readonly jump: ReturnType<typeof vi.fn>;
	readonly on: ReturnType<typeof vi.fn>;
	readonly onSet: (listener: () => void) => () => void;
	readonly set: ReturnType<typeof vi.fn>;
	readonly startAnimation: () => void;
}

const motionState = vi.hoisted(() => ({
	postRenderQueue: [] as Array<() => void>,
	springs: [] as FakeMotionValue[],
	targets: [] as FakeMotionValue[],
	throwOnSubscribe: false,
	throwOnSpring: false,
	throwOnTween: false,
	tweens: [] as Array<{
		readonly ease: string;
		readonly from: number;
		readonly onComplete: () => void;
		readonly onUpdate: (value: number) => void;
		readonly options: {
			readonly delay: number;
			readonly duration: number;
		};
		readonly stop: ReturnType<typeof vi.fn>;
		readonly to: number;
	}>,
}));

vi.mock("motion", () => {
	const createValue = (initialValue: number): FakeMotionValue => {
		let animating = false;
		let currentValue = initialValue;
		const listeners = new Set<(value: number) => void>();
		const setListeners = new Set<() => void>();
		return {
			destroy: vi.fn(() => {
				animating = false;
				listeners.clear();
				setListeners.clear();
			}),
			emit: (value) => {
				for (const listener of listeners) listener(value);
			},
			get: () => currentValue,
			isAnimating: () => animating,
			jump: vi.fn((value: number) => {
				currentValue = value;
				animating = false;
			}),
			on: vi.fn((_event: string, listener: (value: number) => void) => {
				if (motionState.throwOnSubscribe) throw new Error("subscription failed");
				listeners.add(listener);
				return vi.fn(() => listeners.delete(listener));
			}),
			onSet: (listener) => {
				setListeners.add(listener);
				return () => setListeners.delete(listener);
			},
			set: vi.fn((value: number) => {
				currentValue = value;
				for (const listener of setListeners) listener();
			}),
			startAnimation: () => {
				animating = true;
			},
		};
	};
	return {
		animate: (
			from: number,
			to: number,
			options: {
				readonly delay: number;
				readonly duration: number;
				readonly ease: string;
				readonly onComplete: () => void;
				readonly onUpdate: (value: number) => void;
			},
		) => {
			if (motionState.throwOnTween) throw new Error("tween failed");
			const tween = {
				ease: options.ease,
				from,
				onComplete: options.onComplete,
				onUpdate: options.onUpdate,
				options,
				stop: vi.fn(),
				to,
			};
			motionState.tweens.push(tween);
			return {
				stop: tween.stop,
			};
		},
		motionValue: (initialValue: number) => {
			const value = createValue(initialValue);
			motionState.targets.push(value);
			return value;
		},
		springValue: (target: FakeMotionValue) => {
			if (motionState.throwOnSpring) throw new Error("spring failed");
			const value = createValue(target.get());
			target.onSet(() => {
				motionState.postRenderQueue.push(() => {
					if (value.get() !== target.get()) value.startAnimation();
				});
			});
			motionState.springs.push(value);
			return value;
		},
	};
});

const createDriver = () => {
	const frameCallbacks = new Map<number, FrameRequestCallback>();
	let nextFrameId = 0;
	const invalidate = vi.fn();
	const reportCriticalFailure = vi.fn();
	const driver = Effect.runSync(
		createPixiAnimationDriverFx({
			cancelFrame: (frameId) => {
				frameCallbacks.delete(frameId);
			},
			frames: {
				invalidateFx: Effect.sync(invalidate),
				reportCriticalFailure,
			} as unknown as DemandFrameLoop,
			requestFrame: (callback) => {
				nextFrameId += 1;
				frameCallbacks.set(nextFrameId, callback);
				return nextFrameId;
			},
		}),
	);
	return {
		driver,
		flushFrames: () => {
			const callbacks = [
				...frameCallbacks.values(),
			];
			frameCallbacks.clear();
			for (const callback of callbacks) callback(performance.now());
		},
		frameCallbacks,
		invalidate,
		reportCriticalFailure,
	};
};

describe("Pixi animation driver", () => {
	beforeEach(() => {
		motionState.postRenderQueue.length = 0;
		motionState.springs.length = 0;
		motionState.targets.length = 0;
		motionState.throwOnSpring = false;
		motionState.throwOnSubscribe = false;
		motionState.throwOnTween = false;
		motionState.tweens.length = 0;
	});

	it("normalizes tween time, invalidates updates and suppresses callbacks after stop", () => {
		const { driver, invalidate } = createDriver();
		const onComplete = vi.fn();
		const onUpdate = vi.fn();
		const control = Effect.runSync(
			driver.startTweenFx({
				delayMs: 120,
				durationMs: 450,
				from: 0,
				onComplete,
				onUpdate,
				to: 1,
			}),
		);
		const tween = motionState.tweens[0];

		expect(tween?.options).toMatchObject({
			delay: 0.12,
			duration: 0.45,
		});
		expect(tween).toMatchObject({
			ease: "easeInOut",
			from: 0,
			to: 1,
		});
		tween?.onUpdate(0.5);
		expect(onUpdate).toHaveBeenCalledWith(0.5);
		expect(invalidate).toHaveBeenCalledOnce();

		Effect.runSync(control.stopFx);
		tween?.onUpdate(0.75);
		tween?.onComplete();
		expect(tween?.stop).toHaveBeenCalledOnce();
		expect(onUpdate).toHaveBeenCalledOnce();
		expect(onComplete).not.toHaveBeenCalled();
	});

	it("completes a tween exactly once", () => {
		const { driver, flushFrames, frameCallbacks } = createDriver();
		const onComplete = vi.fn();
		Effect.runSync(
			driver.startTweenFx({
				durationMs: 300,
				from: 0,
				onComplete,
				onUpdate: vi.fn(),
				to: 1,
			}),
		);

		motionState.tweens[0]?.onComplete();
		motionState.tweens[0]?.onComplete();
		expect(onComplete).not.toHaveBeenCalled();
		expect(frameCallbacks.size).toBe(1);
		flushFrames();
		Effect.runSync(driver.closeFx);
		Effect.runSync(driver.closeFx);
		expect(onComplete).toHaveBeenCalledOnce();
		expect(motionState.tweens[0]?.stop).not.toHaveBeenCalled();
	});

	it("reports consumer callback failures while containing Motion callbacks", () => {
		const { driver, flushFrames, invalidate, reportCriticalFailure } = createDriver();
		Effect.runSync(
			driver.startTweenFx({
				durationMs: 300,
				from: 0,
				onComplete: () => {
					throw new Error("complete failed");
				},
				onUpdate: () => {
					throw new Error("update failed");
				},
				to: 1,
			}),
		);

		expect(() => motionState.tweens[0]?.onUpdate(0.5)).not.toThrow();
		expect(() => motionState.tweens[0]?.onComplete()).not.toThrow();
		expect(() => flushFrames()).not.toThrow();
		expect(invalidate).toHaveBeenCalledOnce();
		expect(reportCriticalFailure).toHaveBeenCalledTimes(2);
	});

	it("cancels presentation completion while the final frame is pending", () => {
		const { driver, flushFrames, frameCallbacks } = createDriver();
		const onComplete = vi.fn();
		const control = Effect.runSync(
			driver.startTweenFx({
				durationMs: 300,
				from: 0,
				onComplete,
				onUpdate: vi.fn(),
				to: 1,
			}),
		);

		motionState.tweens[0]?.onComplete();
		expect(frameCallbacks.size).toBe(1);
		Effect.runSync(control.stopFx);
		expect(frameCallbacks.size).toBe(0);
		flushFrames();
		expect(onComplete).not.toHaveBeenCalled();
		expect(motionState.tweens[0]?.stop).not.toHaveBeenCalled();
	});

	it("retargets one persistent spring and disposes it exactly once", () => {
		const { driver, invalidate } = createDriver();
		const onUpdate = vi.fn();
		const spring = Effect.runSync(
			driver.createSpringFx({
				initialValue: 0,
				onUpdate,
				options: {
					damping: 30,
					mass: 1,
					restDelta: 0.1,
					restSpeed: 0.1,
					stiffness: 300,
				},
			}),
		);

		Effect.runSync(spring.setTargetFx(10));
		Effect.runSync(spring.setTargetFx(20));
		expect(motionState.targets).toHaveLength(1);
		expect(motionState.springs).toHaveLength(1);
		expect(motionState.targets[0]?.set).toHaveBeenNthCalledWith(1, 10);
		expect(motionState.targets[0]?.set).toHaveBeenNthCalledWith(2, 20);
		motionState.springs[0]?.emit(12);
		expect(onUpdate).toHaveBeenCalledWith(12);
		expect(invalidate).toHaveBeenCalledOnce();

		Effect.runSync(spring.closeFx);
		Effect.runSync(spring.closeFx);
		for (const postRender of motionState.postRenderQueue.splice(0)) postRender();
		motionState.springs[0]?.emit(14);
		expect(onUpdate).toHaveBeenCalledOnce();
		expect(motionState.springs[0]?.jump).toHaveBeenCalledWith(20);
		expect(motionState.springs[0]?.isAnimating()).toBe(false);
		expect(motionState.springs[0]?.destroy).toHaveBeenCalledOnce();
		expect(motionState.targets[0]?.destroy).toHaveBeenCalledOnce();
	});

	it("closes every resource and creates nothing after close", () => {
		const { driver } = createDriver();
		Effect.runSync(
			driver.startTweenFx({
				durationMs: 300,
				from: 0,
				onUpdate: vi.fn(),
				to: 1,
			}),
		);
		Effect.runSync(
			driver.createSpringFx({
				initialValue: 0,
				onUpdate: vi.fn(),
				options: {
					damping: 30,
					mass: 1,
					restDelta: 0.1,
					restSpeed: 0.1,
					stiffness: 300,
				},
			}),
		);
		Effect.runSync(driver.closeFx);

		expect(motionState.tweens[0]?.stop).toHaveBeenCalledOnce();
		expect(motionState.springs[0]?.destroy).toHaveBeenCalledOnce();
		const resourceCounts = {
			springs: motionState.springs.length,
			targets: motionState.targets.length,
			tweens: motionState.tweens.length,
		};
		Effect.runSync(
			driver.startTweenFx({
				durationMs: 300,
				from: 0,
				onUpdate: vi.fn(),
				to: 1,
			}),
		);
		Effect.runSync(
			driver.createSpringFx({
				initialValue: 0,
				onUpdate: vi.fn(),
				options: {
					damping: 30,
					mass: 1,
					restDelta: 0.1,
					restSpeed: 0.1,
					stiffness: 300,
				},
			}),
		);
		expect({
			springs: motionState.springs.length,
			targets: motionState.targets.length,
			tweens: motionState.tweens.length,
		}).toEqual(resourceCounts);
	});

	it("rolls back partially acquired spring resources", () => {
		const { driver } = createDriver();
		const props = {
			initialValue: 0,
			onUpdate: vi.fn(),
			options: {
				damping: 30,
				mass: 1,
				restDelta: 0.1,
				restSpeed: 0.1,
				stiffness: 300,
			},
		};
		motionState.throwOnSpring = true;
		expect(() => Effect.runSync(driver.createSpringFx(props))).toThrow();
		expect(motionState.targets[0]?.destroy).toHaveBeenCalledOnce();

		motionState.throwOnSpring = false;
		motionState.throwOnSubscribe = true;
		expect(() => Effect.runSync(driver.createSpringFx(props))).toThrow();
		expect(motionState.targets[1]?.destroy).toHaveBeenCalledOnce();
		expect(motionState.springs[0]?.destroy).toHaveBeenCalledOnce();
	});

	it("does not retain a failed tween acquisition", () => {
		const { driver } = createDriver();
		motionState.throwOnTween = true;

		expect(() =>
			Effect.runSync(
				driver.startTweenFx({
					durationMs: 300,
					from: 0,
					onUpdate: vi.fn(),
					to: 1,
				}),
			),
		).toThrow();
		expect(motionState.tweens).toHaveLength(0);
		expect(() => Effect.runSync(driver.closeFx)).not.toThrow();
	});

	it("attempts every cleanup when one Motion control throws", () => {
		const { driver } = createDriver();
		for (let index = 0; index < 2; index += 1) {
			Effect.runSync(
				driver.startTweenFx({
					durationMs: 300,
					from: 0,
					onUpdate: vi.fn(),
					to: 1,
				}),
			);
		}
		motionState.tweens[0]?.stop.mockImplementationOnce(() => {
			throw new Error("stop failed");
		});

		expect(() => Effect.runSync(driver.closeFx)).toThrow();
		expect(motionState.tweens[0]?.stop).toHaveBeenCalledOnce();
		expect(motionState.tweens[1]?.stop).toHaveBeenCalledOnce();
	});
});
