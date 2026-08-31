import { Deferred, Effect, Fiber, Result } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, it, vi } from "vitest";
import { ArkiniElectronApi } from "../../electron/contract/ArkiniElectronApi";
import { createHarness } from "./createWindowModeControllerFx.test/fixture";

const electronState = vi.hoisted(() => ({
	workArea: {
		x: 100,
		y: 50,
		width: 1_600,
		height: 1_000,
	},
}));

vi.mock("electron", () => ({
	screen: {
		getDisplayMatching: () => ({
			workArea: electronState.workArea,
		}),
	},
}));

describe("createWindowModeControllerFx", () => {
	it("waits for Electron to confirm exclusive fullscreen before completing", async () => {
		const harness = createHarness("default");
		let completed = false;
		const request = Effect.runPromise(harness.controller.requestModeFx("fullscreen")).then(
			() => {
				completed = true;
			},
		);

		expect(harness.setFullScreen).toHaveBeenCalledWith(true);
		expect(completed).toBe(false);
		harness.emit("enter-full-screen");
		await request;

		expect(harness.writes).toEqual([
			"fullscreen",
		]);
		expect(harness.send).toHaveBeenCalledWith(
			ArkiniElectronApi.channels.windowModeChanged,
			"fullscreen",
		);
	});

	it("completes only after the confirmed mode is persisted", async () => {
		const persistenceRelease = Deferred.makeUnsafe<void>();
		let persistenceStarted = false;
		const harness = createHarness("default", {
			writeModeFx: () =>
				Effect.sync(() => {
					persistenceStarted = true;
				}).pipe(Effect.andThen(Deferred.await(persistenceRelease))),
		});
		let completed = false;
		const request = Effect.runPromise(harness.controller.requestModeFx("fullscreen")).then(
			() => {
				completed = true;
			},
		);

		harness.emit("enter-full-screen");
		await vi.waitFor(() => expect(persistenceStarted).toBe(true));
		expect(completed).toBe(false);
		await Effect.runPromise(Deferred.succeed(persistenceRelease, undefined));
		await request;

		expect(completed).toBe(true);
	});

	it("restores canonical default bounds after leaving fullscreen", async () => {
		const harness = createHarness("fullscreen");
		const request = Effect.runPromise(harness.controller.requestModeFx("default"));

		expect(harness.setFullScreen).toHaveBeenCalledWith(false);
		harness.emit("leave-full-screen");
		await request;

		expect(harness.unmaximize).toHaveBeenCalledOnce();
		expect(harness.setBounds).toHaveBeenCalledWith({
			x: 300,
			y: 175,
			width: 1_200,
			height: 750,
		});
		expect(harness.writes).toEqual([
			"default",
		]);
	});

	it("settles explicit windowed modes without native maximize events", async () => {
		const harness = createHarness("default");

		await Effect.runPromise(harness.controller.requestModeFx("bordered"));
		expect(harness.maximize).toHaveBeenCalledOnce();
		expect(harness.isMaximized()).toBe(true);
		expect(harness.writes).toEqual([
			"bordered",
		]);
		expect(harness.send).toHaveBeenLastCalledWith(
			ArkiniElectronApi.channels.windowModeChanged,
			"bordered",
		);

		await Effect.runPromise(harness.controller.requestModeFx("default"));
		expect(harness.unmaximize).toHaveBeenCalledOnce();
		expect(harness.isMaximized()).toBe(false);
		expect(harness.writes).toEqual([
			"bordered",
			"default",
		]);
		expect(harness.send).toHaveBeenLastCalledWith(
			ArkiniElectronApi.channels.windowModeChanged,
			"default",
		);
	});

	it("records passive native maximize changes", async () => {
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
	});

	it("keeps a newer explicit windowed mode after a stale native event", async () => {
		const harness = createHarness("default");

		await Effect.runPromise(harness.controller.requestModeFx("bordered"));
		await Effect.runPromise(harness.controller.requestModeFx("default"));
		harness.emitWithoutStateChange("maximize");
		await vi.waitFor(() =>
			expect(harness.writes).toEqual([
				"bordered",
				"default",
				"default",
			]),
		);

		expect(harness.isMaximized()).toBe(false);
		expect(harness.send).toHaveBeenLastCalledWith(
			ArkiniElectronApi.channels.windowModeChanged,
			"default",
		);
	});

	it("toggles fullscreen through F11 and returns to the prior windowed mode", async () => {
		const harness = createHarness("bordered");
		const preventDefault = vi.fn();

		harness.getShortcutListener()?.(
			{
				preventDefault,
			},
			{
				type: "keyDown",
				key: "F11",
				alt: false,
				isAutoRepeat: false,
			},
		);
		expect(preventDefault).toHaveBeenCalledOnce();
		expect(harness.setFullScreen).toHaveBeenCalledWith(true);
		harness.emit("enter-full-screen");
		await vi.waitFor(() => expect(harness.writes).toContain("fullscreen"));

		harness.getShortcutListener()?.(
			{
				preventDefault,
			},
			{
				type: "keyDown",
				key: "F11",
				alt: false,
				isAutoRepeat: false,
			},
		);
		expect(harness.setFullScreen).toHaveBeenLastCalledWith(false);
		harness.emit("leave-full-screen");
		await vi.waitFor(() => expect(harness.writes.at(-1)).toBe("bordered"));
	});

	it("supersedes only the older request and ignores its stale native event", async () => {
		const harness = createHarness("default", {
			deferFullscreenStateUntilEvent: true,
		});
		const older = Effect.runPromise(
			Effect.result(harness.controller.requestModeFx("fullscreen")),
		);
		const newer = Effect.runPromise(harness.controller.requestModeFx("default"));
		let newerCompleted = false;
		void newer.then(() => {
			newerCompleted = true;
		});

		const olderResult = await older;
		expect(Result.isFailure(olderResult)).toBe(true);
		if (Result.isFailure(olderResult)) {
			expect(olderResult.failure).toEqual(
				new Error("Window mode request was superseded by default."),
			);
		}
		harness.emit("enter-full-screen");
		await vi.waitFor(() => expect(harness.setFullScreen).toHaveBeenLastCalledWith(false));
		expect(newerCompleted).toBe(false);

		harness.emit("leave-full-screen");
		await newer;
		expect(harness.writes).toEqual([
			"default",
		]);
	});

	it("uses the Effect clock for timeout and allows a fresh native retry", async () => {
		const harness = createHarness("default", {
			deferFullscreenStateUntilEvent: true,
		});
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const request = yield* harness.controller
					.requestModeFx("fullscreen")
					.pipe(Effect.result, Effect.forkChild);
				yield* Effect.yieldNow;
				yield* TestClock.adjust(5_000);
				const timedOut = yield* Fiber.join(request);
				const retry = yield* harness.controller
					.requestModeFx("fullscreen")
					.pipe(Effect.forkChild);
				yield* Effect.yieldNow;
				yield* Fiber.interrupt(retry);
				return timedOut;
			}).pipe(
				Effect.provide(
					TestClock.layer({
						warningDelay: "1 hour",
					}),
				),
			),
		);

		expect(Result.isFailure(result)).toBe(true);
		if (Result.isFailure(result)) {
			expect(result.failure).toEqual(
				new Error("Electron did not confirm fullscreen mode in time."),
			);
		}
		expect(harness.setFullScreen).toHaveBeenCalledTimes(2);
	});

	it("caller interruption removes only its own pending request", async () => {
		const harness = createHarness("default");
		await Effect.runPromise(
			Effect.gen(function* () {
				const request = yield* harness.controller
					.requestModeFx("fullscreen")
					.pipe(Effect.forkChild);
				yield* Effect.yieldNow;
				yield* Fiber.interrupt(request);
			}),
		);

		let completed = false;
		const next = Effect.runPromise(harness.controller.requestModeFx("default")).then(() => {
			completed = true;
		});
		harness.emit("enter-full-screen");
		await Promise.resolve();
		expect(completed).toBe(false);
		harness.emit("leave-full-screen");
		await next;

		expect(harness.writes).toEqual([
			"default",
		]);
	});

	it("fails a pending request exactly once when the window closes", async () => {
		const harness = createHarness("default");
		const request = Effect.runPromise(
			Effect.result(harness.controller.requestModeFx("fullscreen")),
		);

		harness.emit("closed");
		harness.emit("closed");
		const result = await request;

		expect(Result.isFailure(result)).toBe(true);
		if (Result.isFailure(result)) {
			expect(result.failure).toEqual(
				new Error("The window closed before its mode transition completed."),
			);
		}
		expect(harness.writes).toEqual([]);
	});
});
