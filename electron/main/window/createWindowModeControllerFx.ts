import { screen, type BrowserWindow } from "electron";
import { Deferred, Effect, Exit, Fiber, FiberHandle, Queue, Scope, SynchronizedRef } from "effect";
import { ArkiniElectronApi } from "~electron/contract/ArkiniElectronApi";
import type { WindowModeSchema } from "~electron/contract/window/WindowModeSchema";
import { ElectronMainRuntime } from "../ElectronMainRuntime";
import type { WindowPreferences } from "./createFilesystemWindowPreferencesFx";
import { calculateInitialWindowBoundsFn } from "./fn/calculateInitialWindowBoundsFn";

/** Sole per-BrowserWindow authority for requested and Electron-confirmed native modes. */
export interface WindowModeController {
	readonly requestModeFx: (mode: WindowModeSchema.Type) => Effect.Effect<void, unknown, never>;
}

type WindowedMode = Exclude<WindowModeSchema.Type, "fullscreen">;

interface PendingRequest {
	readonly mode: WindowModeSchema.Type;
	readonly nativeConfirmations: Queue.Queue<NativeConfirmation>;
	readonly outcome: Deferred.Deferred<void, unknown>;
}

type NativeConfirmation = "enter-full-screen" | "leave-full-screen";

const NATIVE_TRANSITION_TIMEOUT_MS = 5_000;

/** Creates the one native-mode lifecycle owner for a BrowserWindow. */
export const createWindowModeControllerFx = Effect.fn("createWindowModeControllerFx")(
	({
		initialMode,
		window,
		windowPreferences,
	}: {
		readonly initialMode: WindowModeSchema.Type;
		readonly window: BrowserWindow;
		readonly windowPreferences: WindowPreferences;
	}) =>
		Effect.gen(function* () {
			let currentMode = initialMode;
			let previousWindowedMode: WindowedMode =
				initialMode === "fullscreen" ? "default" : initialMode;
			let nativeFullscreenTarget = initialMode === "fullscreen";
			let applyingWindowedMode = false;

			const controllerScope = yield* Scope.make();
			const requestFibers = yield* FiberHandle.make<void, never>().pipe(
				Effect.provideService(Scope.Scope, controllerScope),
			);
			const pendingRequest = yield* SynchronizedRef.make<PendingRequest | undefined>(
				undefined,
			);

			const clearPendingRequestFx = (request: PendingRequest) =>
				SynchronizedRef.update(pendingRequest, (candidate) =>
					candidate === request ? undefined : candidate,
				);

			const applyWindowedModeFx = (mode: WindowedMode) =>
				Effect.gen(function* () {
					applyingWindowedMode = true;
					if (mode === "bordered") {
						window.maximize();
						return;
					}
					const display = screen.getDisplayMatching(window.getBounds());
					const { x, y, width, height } = calculateInitialWindowBoundsFn(
						display.workArea,
					);
					window.unmaximize();
					yield* Effect.callback<void>((resume) => {
						const immediate = setImmediate(() => resume(Effect.void));
						return Effect.sync(() => clearImmediate(immediate));
					});
					window.setBounds({
						x,
						y,
						width,
						height,
					});
				}).pipe(
					Effect.ensuring(
						Effect.sync(() => {
							applyingWindowedMode = false;
						}),
					),
				);

			const publishMode = (mode: WindowModeSchema.Type) => {
				nativeFullscreenTarget = mode === "fullscreen";
				if (mode === "fullscreen") {
					if (currentMode !== "fullscreen") previousWindowedMode = currentMode;
				} else {
					previousWindowedMode = mode;
				}
				currentMode = mode;
				if (!window.webContents.isDestroyed()) {
					window.webContents.send(ArkiniElectronApi.channels.windowModeChanged, mode);
				}
			};

			const persistPassiveModeFx = (mode: WindowModeSchema.Type) =>
				windowPreferences.writeModeFx(mode).pipe(
					Effect.catchCause((cause) =>
						Effect.sync(() => {
							console.error("Arkini window mode could not be persisted.", cause);
						}),
					),
				);

			const settlePassiveModeFx = (mode: WindowModeSchema.Type) =>
				Effect.sync(() => publishMode(mode)).pipe(
					Effect.andThen(persistPassiveModeFx(mode)),
				);

			const readPendingRequestFx = SynchronizedRef.get(pendingRequest);

			const confirmNativeModeFx = (
				confirmation: NativeConfirmation,
				mode: WindowModeSchema.Type,
			) =>
				Effect.gen(function* () {
					const request = yield* readPendingRequestFx;
					if (request !== undefined) {
						yield* Queue.offer(request.nativeConfirmations, confirmation);
						return;
					}
					yield* settlePassiveModeFx(mode);
				});

			const awaitNativeConfirmationFx = (
				request: PendingRequest,
				expected: NativeConfirmation,
			): Effect.Effect<void, never, never> =>
				Effect.gen(function* () {
					while ((yield* Queue.take(request.nativeConfirmations)) !== expected) {
						// Electron can still deliver a superseded transition's native event.
					}
				});

			const applyFullscreenStateFx = (request: PendingRequest, fullscreen: boolean) =>
				Effect.gen(function* () {
					const awaitConfirmationFx = (nextFullscreen: boolean) =>
						awaitNativeConfirmationFx(
							request,
							nextFullscreen ? "enter-full-screen" : "leave-full-screen",
						);

					if (window.isFullScreen() !== nativeFullscreenTarget) {
						yield* awaitConfirmationFx(nativeFullscreenTarget);
					}
					if (window.isFullScreen() === fullscreen) return;
					nativeFullscreenTarget = fullscreen;
					window.setFullScreen(fullscreen);
					yield* awaitConfirmationFx(fullscreen);
				});

			const requestLifecycleFx = (request: PendingRequest) =>
				Effect.gen(function* () {
					yield* Effect.gen(function* () {
						if (request.mode === "fullscreen") {
							if (currentMode !== "fullscreen") previousWindowedMode = currentMode;
							yield* applyFullscreenStateFx(request, true);
						} else {
							yield* applyFullscreenStateFx(request, false);
							yield* applyWindowedModeFx(request.mode);
						}
					}).pipe(
						Effect.timeoutOrElse({
							duration: NATIVE_TRANSITION_TIMEOUT_MS,
							orElse: () =>
								Effect.sync(() => {
									nativeFullscreenTarget = window.isFullScreen();
								}).pipe(
									Effect.andThen(
										Effect.fail(
											new Error(
												`Electron did not confirm ${request.mode} mode in time.`,
											),
										),
									),
								),
						}),
					);

					yield* Effect.sync(() => publishMode(request.mode));
					yield* windowPreferences.writeModeFx(request.mode);
				}).pipe(Effect.ensuring(clearPendingRequestFx(request)));

			const requestModeFx = (mode: WindowModeSchema.Type) =>
				Effect.gen(function* () {
					const request: PendingRequest = {
						mode,
						nativeConfirmations: yield* Queue.unbounded<NativeConfirmation>(),
						outcome: yield* Deferred.make<void, unknown>(),
					};
					const fiber = yield* SynchronizedRef.modifyEffect(pendingRequest, (previous) =>
						Effect.gen(function* () {
							if (previous !== undefined) {
								yield* Deferred.fail(
									previous.outcome,
									new Error(`Window mode request was superseded by ${mode}.`),
								);
							}
							const nextFiber = yield* FiberHandle.run(
								requestFibers,
								Deferred.into(requestLifecycleFx(request), request.outcome).pipe(
									Effect.asVoid,
								),
							);
							return [
								nextFiber,
								request,
							] as const;
						}),
					);

					return yield* Deferred.await(request.outcome).pipe(
						Effect.onInterrupt(() =>
							clearPendingRequestFx(request).pipe(
								Effect.andThen(Fiber.interrupt(fiber)),
							),
						),
					);
				});

			window.on("enter-full-screen", () => {
				void ElectronMainRuntime.runPromise(
					confirmNativeModeFx("enter-full-screen", "fullscreen"),
				);
			});
			window.on("leave-full-screen", () => {
				void ElectronMainRuntime.runPromise(
					Effect.gen(function* () {
						const request = yield* readPendingRequestFx;
						if (request !== undefined) {
							yield* Queue.offer(request.nativeConfirmations, "leave-full-screen");
							return;
						}
						yield* applyWindowedModeFx(previousWindowedMode);
						yield* settlePassiveModeFx(previousWindowedMode);
					}),
				);
			});
			window.on("maximize", () => {
				if (window.isFullScreen()) return;
				void ElectronMainRuntime.runPromise(
					Effect.gen(function* () {
						const request = yield* readPendingRequestFx;
						if (request !== undefined) return;
						if (!applyingWindowedMode) {
							yield* settlePassiveModeFx(
								window.isMaximized() ? "bordered" : "default",
							);
						}
					}),
				);
			});
			window.on("unmaximize", () => {
				if (window.isFullScreen()) return;
				void ElectronMainRuntime.runPromise(
					Effect.gen(function* () {
						const request = yield* readPendingRequestFx;
						if (request !== undefined) return;
						if (!applyingWindowedMode) {
							yield* settlePassiveModeFx(
								window.isMaximized() ? "bordered" : "default",
							);
						}
					}),
				);
			});
			window.once("closed", () => {
				void ElectronMainRuntime.runPromise(
					SynchronizedRef.modifyEffect(pendingRequest, (request) =>
						Effect.gen(function* () {
							if (request !== undefined) {
								yield* Deferred.fail(
									request.outcome,
									new Error(
										"The window closed before its mode transition completed.",
									),
								);
							}
							return [
								undefined,
								undefined,
							] as const;
						}),
					).pipe(Effect.andThen(Scope.close(controllerScope, Exit.void))),
				);
			});
			window.webContents.on("before-input-event", (event, input) => {
				if (input.type !== "keyDown" || input.isAutoRepeat) return;
				const isFullscreenToggle =
					input.key === "F11" || (input.alt && input.key === "Enter");
				if (!isFullscreenToggle) return;
				event.preventDefault();
				void ElectronMainRuntime.runPromise(
					requestModeFx(
						currentMode === "fullscreen" ? previousWindowedMode : "fullscreen",
					),
				).catch((cause) => {
					console.error("Arkini window mode shortcut failed.", cause);
				});
			});

			return {
				requestModeFx,
			} satisfies WindowModeController;
		}),
);
