import { Deferred, Effect, Result } from "effect";
import { TestClock } from "effect/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SerakkiElectronApi } from "~electron/contract/SerakkiElectronApi";
import { ElectronMainError } from "~electron/main/ElectronMainError";
import { createHarness as createWindowHarness } from "./createWindowModeControllerFx.test/fixture";

vi.mock("electron", () => ({
	screen: {
		getDisplayMatching: () => ({
			workArea: {
				x: 100,
				y: 50,
				width: 1_600,
				height: 1_000,
			},
		}),
	},
}));

const harnesses: ReturnType<typeof createWindowHarness>[] = [];
const createHarness: typeof createWindowHarness = (...args) => {
	const harness = createWindowHarness(...args);
	harnesses.push(harness);
	return harness;
};
afterEach(async () => {
	for (const harness of harnesses.splice(0)) harness.emit("closed");
	await Promise.resolve();
	vi.restoreAllMocks();
});

const withClock = <A, E>(program: Effect.Effect<A, E>) =>
	Effect.runPromise(
		program.pipe(
			Effect.provide(
				TestClock.layer({
					warningDelay: "1 hour",
				}),
			),
		),
	);

describe("createWindowModeControllerFx", () => {
	it("saves and completes without waiting for delayed native fullscreen state", async () => {
		const harness = createHarness("default", {
			deferFullscreenStateUntilEvent: true,
		});
		await Effect.runPromise(harness.controller.requestModeFx("fullscreen"));
		expect(harness.setFullScreen).toHaveBeenCalledWith(true);
		expect(harness.writes).toEqual([
			"fullscreen",
		]);
		expect(harness.send).toHaveBeenLastCalledWith(
			SerakkiElectronApi.channels.windowModeChanged,
			"fullscreen",
		);
		harness.emit("enter-full-screen");
	});

	it("does not publish or apply a preference until its write succeeds", async () => {
		const release = Deferred.makeUnsafe<void>();
		const harness = createHarness("default", {
			writeModeFx: () => Deferred.await(release),
		});
		let completed = false;
		const request = Effect.runPromise(harness.controller.requestModeFx("fullscreen")).then(
			() => {
				completed = true;
			},
		);
		expect(completed).toBe(false);
		expect(harness.send).not.toHaveBeenCalled();
		expect(harness.setFullScreen).not.toHaveBeenCalled();
		await Effect.runPromise(Deferred.succeed(release, undefined));
		await request;
		expect(completed).toBe(true);
		expect(harness.setFullScreen).toHaveBeenCalledWith(true);
	});

	it("propagates a preference failure without claiming or applying the unsaved mode", async () => {
		const failure = new ElectronMainError({
			operation: "write preference",
			cause: new Error("disk full"),
		});
		const harness = createHarness("default", {
			writeModeFx: () => Effect.fail(failure),
		});
		const result = await Effect.runPromise(
			Effect.result(harness.controller.requestModeFx("fullscreen")),
		);
		expect(Result.isFailure(result) && result.failure).toBe(failure);
		expect(harness.send).not.toHaveBeenCalled();
		expect(harness.setFullScreen).not.toHaveBeenCalled();
	});

	it.each([
		false,
		true,
	])(
		"accepts synchronous state with synchronous event=%s without a false timeout",
		async (synchronousFullscreenEvent) => {
			const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
			const harness = createHarness("default", {
				synchronousFullscreenEvent,
			});
			await withClock(
				Effect.gen(function* () {
					yield* harness.controller.requestModeFx("fullscreen");
					yield* TestClock.adjust(5_000);
				}),
			);
			expect(harness.writes).toEqual([
				"fullscreen",
			]);
			expect(warn).not.toHaveBeenCalled();
		},
	);

	it("restores canonical default bounds after fullscreen actually exits", async () => {
		const harness = createHarness("fullscreen", {
			deferFullscreenStateUntilEvent: true,
		});
		await withClock(
			Effect.gen(function* () {
				yield* harness.controller.requestModeFx("default");
				expect(harness.setBounds).not.toHaveBeenCalled();
				harness.emit("leave-full-screen");
				yield* TestClock.adjust(50);
			}),
		);
		expect(harness.setBounds).toHaveBeenCalledWith({
			x: 220,
			y: 125,
			width: 1_360,
			height: 850,
		});
		expect(harness.writes).toEqual([
			"default",
		]);
	});

	it("keeps the saved preference and allows another choice after native timeout", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const harness = createHarness("default", {
			deferFullscreenStateUntilEvent: true,
		});
		await withClock(
			Effect.gen(function* () {
				yield* harness.controller.requestModeFx("fullscreen");
				expect(harness.writes).toEqual([
					"fullscreen",
				]);
				yield* TestClock.adjust(5_000);
				yield* harness.controller.requestModeFx("bordered");
			}),
		);
		expect(warn).toHaveBeenCalledOnce();
		expect(harness.writes).toEqual([
			"fullscreen",
			"bordered",
		]);
		expect(harness.maximize).toHaveBeenCalledOnce();
	});

	it("persists a newer request immediately while an earlier native transition is still pending", async () => {
		const harness = createHarness("default", {
			deferFullscreenStateUntilEvent: true,
		});
		await withClock(
			Effect.gen(function* () {
				yield* harness.controller.requestModeFx("fullscreen");
				yield* harness.controller.requestModeFx("default");
				expect(harness.writes).toEqual([
					"fullscreen",
					"default",
				]);
				harness.emit("enter-full-screen");
				yield* TestClock.adjust(50);
				expect(harness.setFullScreen).toHaveBeenLastCalledWith(false);
				harness.emit("leave-full-screen");
				yield* TestClock.adjust(50);
			}),
		);
		expect(harness.writes.at(-1)).toBe("default");
		expect(harness.setBounds).toHaveBeenCalledOnce();
	});

	it("does not let a late timed-out transition overwrite the newer saved choice", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const harness = createHarness("default", {
			deferFullscreenStateUntilEvent: true,
		});
		await withClock(
			Effect.gen(function* () {
				yield* harness.controller.requestModeFx("fullscreen");
				yield* TestClock.adjust(5_000);
				yield* harness.controller.requestModeFx("default");
				harness.emit("enter-full-screen");
				yield* Effect.yieldNow;
				expect(harness.setFullScreen).toHaveBeenLastCalledWith(false);
				harness.emit("leave-full-screen");
				yield* TestClock.adjust(50);
			}),
		);
		expect(harness.writes.slice(1).every((mode) => mode === "default")).toBe(true);
		expect(harness.send).toHaveBeenLastCalledWith(
			SerakkiElectronApi.channels.windowModeChanged,
			"default",
		);
	});

	it("does not let a timed-out maximize overwrite a newer default preference", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const harness = createHarness("default", {
			deferMaximizeStateUntilEvent: true,
		});
		await withClock(
			Effect.gen(function* () {
				yield* harness.controller.requestModeFx("bordered");
				yield* TestClock.adjust(5_000);
				yield* harness.controller.requestModeFx("default");
				harness.emit("maximize");
				yield* Effect.yieldNow;
			}),
		);
		expect(harness.isMaximized()).toBe(false);
		expect(harness.writes.slice(1).every((mode) => mode === "default")).toBe(true);
	});

	it("guards late acknowledgement reconciliation queued behind a newer write", async () => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		const release = Deferred.makeUnsafe<void>();
		const writes: string[] = [];
		const harness = createHarness("default", {
			deferFullscreenStateUntilEvent: true,
			writeModeFx: (mode) =>
				Effect.gen(function* () {
					if (mode === "bordered") yield* Deferred.await(release);
					writes.push(mode);
				}),
		});
		await withClock(
			Effect.gen(function* () {
				yield* harness.controller.requestModeFx("fullscreen");
				yield* TestClock.adjust(5_000);
				yield* harness.controller.requestModeFx("default");
				const next = Effect.runPromise(harness.controller.requestModeFx("bordered"));
				harness.emit("enter-full-screen");
				yield* Deferred.succeed(release, undefined);
				yield* Effect.promise(() => next);
				yield* Effect.yieldNow;
			}),
		);
		expect(writes).toEqual([
			"fullscreen",
			"default",
			"bordered",
		]);
	});

	it("serializes concurrent persistence so the newest request remains stored", async () => {
		const release = Deferred.makeUnsafe<void>();
		const writes: string[] = [];
		const harness = createHarness("default", {
			writeModeFx: (mode) =>
				Effect.gen(function* () {
					if (mode === "fullscreen") yield* Deferred.await(release);
					writes.push(mode);
				}),
		});
		const older = Effect.runPromise(harness.controller.requestModeFx("fullscreen"));
		const newer = Effect.runPromise(harness.controller.requestModeFx("bordered"));
		await Effect.runPromise(Deferred.succeed(release, undefined));
		await Promise.all([
			older,
			newer,
		]);
		expect(writes).toEqual([
			"fullscreen",
			"bordered",
		]);
		expect(harness.send).toHaveBeenLastCalledWith(
			SerakkiElectronApi.channels.windowModeChanged,
			"bordered",
		);
	});

	it("ignores a passive event queued behind a newer explicit preference write", async () => {
		const release = Deferred.makeUnsafe<void>();
		const writes: string[] = [];
		const harness = createHarness("default", {
			writeModeFx: (mode) =>
				Effect.gen(function* () {
					if (mode === "fullscreen") yield* Deferred.await(release);
					writes.push(mode);
				}),
		});
		const request = Effect.runPromise(harness.controller.requestModeFx("fullscreen"));
		harness.emit("maximize");
		await Effect.runPromise(Deferred.succeed(release, undefined));
		await request;
		await Promise.resolve();
		expect(writes).toEqual([
			"fullscreen",
		]);
	});

	it("keeps native controls usable after a missing event on a completed transition", async () => {
		const harness = createHarness("default");
		await Effect.runPromise(harness.controller.requestModeFx("fullscreen"));
		harness.emit("leave-full-screen");
		await vi.waitFor(() => expect(harness.writes.at(-1)).toBe("default"));
		harness.emit("enter-full-screen");
		await vi.waitFor(() => expect(harness.writes.at(-1)).toBe("fullscreen"));
	});

	it("records passive maximize and unmaximize but ignores stale event payloads", async () => {
		const harness = createHarness("default");
		harness.emit("maximize");
		await vi.waitFor(() =>
			expect(harness.writes).toEqual([
				"bordered",
			]),
		);
		harness.emit("unmaximize");
		await vi.waitFor(() =>
			expect(harness.writes).toEqual([
				"bordered",
				"default",
			]),
		);
		harness.emitWithoutStateChange("maximize");
		await Promise.resolve();
		expect(harness.writes).toEqual([
			"bordered",
			"default",
		]);
	});

	it("toggles fullscreen through F11 back to the saved windowed mode", async () => {
		const harness = createHarness("bordered");
		const event = {
			preventDefault: vi.fn(),
		};
		const input = {
			type: "keyDown",
			key: "F11",
			alt: false,
			isAutoRepeat: false,
		};
		harness.getShortcutListener()?.(event, input);
		await vi.waitFor(() =>
			expect(harness.writes).toEqual([
				"fullscreen",
			]),
		);
		harness.getShortcutListener()?.(event, input);
		await vi.waitFor(() =>
			expect(harness.writes).toEqual([
				"fullscreen",
				"bordered",
			]),
		);
		expect(event.preventDefault).toHaveBeenCalledTimes(2);
	});

	it("stops pending native work when the window closes", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const harness = createHarness("default", {
			deferFullscreenStateUntilEvent: true,
		});
		await withClock(
			Effect.gen(function* () {
				yield* harness.controller.requestModeFx("fullscreen");
				harness.emit("closed");
				yield* Effect.yieldNow;
				yield* TestClock.adjust(5_000);
			}),
		);
		expect(harness.writes).toEqual([
			"fullscreen",
		]);
		expect(warn).not.toHaveBeenCalled();
		expect(error).not.toHaveBeenCalled();
	});
});
