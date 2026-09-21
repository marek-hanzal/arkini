import { screen, type BrowserWindow } from "electron";
import { Cause, Deferred, Effect, Exit, FiberHandle, Scope, SynchronizedRef } from "effect";
import { SerakkiElectronApi } from "~electron/contract/SerakkiElectronApi";
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
	readonly ready: Deferred.Deferred<void>;
}

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
			let revision = 0;
			let closed = false;
			let previousWindowedMode: WindowedMode =
				initialMode === "fullscreen" ? "default" : initialMode;
			let nativeFullscreenTarget = initialMode === "fullscreen";
			let applyingWindowedMode = false;
			const nativeFullscreenAcknowledgements = new Set<boolean>();
			const nativeWindowedAcknowledgements = new Set<WindowedMode>();

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
						if (!window.isMaximized()) nativeWindowedAcknowledgements.add("bordered");
						window.maximize();
						while (!window.isMaximized()) yield* Effect.sleep(50);
						nativeWindowedAcknowledgements.delete("bordered");
						return;
					}
					const display = screen.getDisplayMatching(window.getBounds());
					const { x, y, width, height } = calculateInitialWindowBoundsFn(
						display.workArea,
					);
					if (window.isMaximized()) nativeWindowedAcknowledgements.add("default");
					window.unmaximize();
					while (window.isMaximized()) yield* Effect.sleep(50);
					nativeWindowedAcknowledgements.delete("default");
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

			const publishModeFn = (mode: WindowModeSchema.Type) => {
				if (mode === "fullscreen") {
					if (currentMode !== "fullscreen") previousWindowedMode = currentMode;
				} else {
					previousWindowedMode = mode;
				}
				currentMode = mode;
				if (!window.webContents.isDestroyed()) {
					window.webContents.send(SerakkiElectronApi.channels.windowModeChanged, mode);
				}
			};

			const readPendingRequestFx = SynchronizedRef.get(pendingRequest);

			// Native events are hints; Windows can update state without delivering the
			// fullscreen event. Polling also handles a synchronous event during setFullScreen.
			const awaitFullscreenStateFx = (fullscreen: boolean) =>
				Effect.gen(function* () {
					while (window.isFullScreen() !== fullscreen) yield* Effect.sleep(50);
					nativeFullscreenAcknowledgements.delete(fullscreen);
				});

			const applyFullscreenStateFx = (fullscreen: boolean) =>
				Effect.gen(function* () {
					if (window.isFullScreen() !== nativeFullscreenTarget) {
						yield* awaitFullscreenStateFx(nativeFullscreenTarget);
					}
					if (window.isFullScreen() === fullscreen) return;
					nativeFullscreenTarget = fullscreen;
					nativeFullscreenAcknowledgements.add(fullscreen);
					window.setFullScreen(fullscreen);
					yield* awaitFullscreenStateFx(fullscreen);
				});

			const requestLifecycleFx = (request: PendingRequest) =>
				Effect.gen(function* () {
					yield* Effect.gen(function* () {
						if (request.mode === "fullscreen") {
							yield* applyFullscreenStateFx(true);
						} else {
							yield* applyFullscreenStateFx(false);
							yield* applyWindowedModeFx(request.mode);
						}
					}).pipe(
						Effect.timeoutOrElse({
							duration: NATIVE_TRANSITION_TIMEOUT_MS,
							orElse: () =>
								Effect.sync(() => {
									nativeFullscreenTarget = window.isFullScreen();
									console.warn(
										`Serakki saved ${request.mode} mode, but Electron did not reach it in time.`,
									);
								}),
						}),
						Effect.catchCause((cause) =>
							Cause.hasInterrupts(cause)
								? Effect.failCause(cause)
								: Effect.sync(() => {
										nativeFullscreenTarget = window.isFullScreen();
										console.error(
											"Serakki saved the window mode, but could not apply it.",
											cause,
										);
									}),
						),
					);
				}).pipe(Effect.ensuring(clearPendingRequestFx(request)));

			const requestModeFx = (mode: WindowModeSchema.Type, passiveRevision?: number) =>
				Effect.gen(function* () {
					const request: PendingRequest = {
						mode,
						ready: yield* Deferred.make<void>(),
					};
					yield* SynchronizedRef.modifyEffect(pendingRequest, (previous) =>
						Effect.gen(function* () {
							if (
								passiveRevision !== undefined &&
								(passiveRevision !== revision || previous !== undefined)
							) {
								return [
									undefined,
									previous,
								] as const;
							}
							// Persist and publish in admission order. Native application runs in
							// the window scope and never holds an IPC caller behind OS confirmation.
							yield* windowPreferences.writeModeFx(mode);
							revision += 1;
							if (passiveRevision !== undefined)
								nativeFullscreenTarget = window.isFullScreen();
							publishModeFn(mode);
							if (closed)
								return [
									undefined,
									previous,
								] as const;
							yield* FiberHandle.run(
								requestFibers,
								Deferred.await(request.ready).pipe(
									Effect.andThen(requestLifecycleFx(request)),
								),
							);
							return [
								undefined,
								request,
							] as const;
						}),
					);
					yield* Deferred.succeed(request.ready, undefined);
				});

			const settlePassiveModeFx = (mode: WindowModeSchema.Type) =>
				Effect.gen(function* () {
					if (mode === currentMode) return;
					yield* requestModeFx(mode, revision);
				}).pipe(
					Effect.catchCause((cause) =>
						Effect.sync(() => {
							console.error(
								"Serakki native window mode could not be persisted.",
								cause,
							);
						}),
					),
				);

			const handleFullscreenEventFx = (fullscreen: boolean, acknowledgement: boolean) =>
				Effect.gen(function* () {
					if ((yield* readPendingRequestFx) !== undefined) return;
					if (acknowledgement) {
						// A timed-out or superseded native transition must not replace the saved
						// intent. The set is bounded by the two possible fullscreen targets.
						if (window.isFullScreen() !== (currentMode === "fullscreen")) {
							yield* requestModeFx(currentMode, revision);
						}
						return;
					}
					if (window.isFullScreen() !== fullscreen) return;
					yield* settlePassiveModeFx(fullscreen ? "fullscreen" : previousWindowedMode);
				});

			window.on("enter-full-screen", () => {
				const acknowledgement = nativeFullscreenAcknowledgements.delete(true);
				void ElectronMainRuntime.runPromise(
					handleFullscreenEventFx(true, acknowledgement),
				).catch((cause) =>
					console.error("Serakki could not reconcile the native window mode.", cause),
				);
			});
			window.on("leave-full-screen", () => {
				const acknowledgement = nativeFullscreenAcknowledgements.delete(false);
				void ElectronMainRuntime.runPromise(
					handleFullscreenEventFx(false, acknowledgement),
				).catch((cause) =>
					console.error("Serakki could not reconcile the native window mode.", cause),
				);
			});
			const onWindowedModeChangedFn = (mode: WindowedMode) => {
				const acknowledgement = nativeWindowedAcknowledgements.delete(mode);
				if (window.isFullScreen() || applyingWindowedMode) return;
				void ElectronMainRuntime.runPromise(
					Effect.gen(function* () {
						if (acknowledgement) {
							if (
								(yield* readPendingRequestFx) === undefined &&
								(window.isMaximized() ? "bordered" : "default") !== currentMode
							) {
								yield* requestModeFx(currentMode, revision);
							}
							return;
						}
						yield* settlePassiveModeFx(window.isMaximized() ? "bordered" : "default");
					}),
				).catch((cause) =>
					console.error("Serakki could not reconcile the native window mode.", cause),
				);
			};
			window.on("maximize", () => onWindowedModeChangedFn("bordered"));
			window.on("unmaximize", () => onWindowedModeChangedFn("default"));
			window.once("closed", () => {
				closed = true;
				void ElectronMainRuntime.runPromise(Scope.close(controllerScope, Exit.void));
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
					console.error("Serakki window mode shortcut failed.", cause);
				});
			});

			return {
				requestModeFx,
			} satisfies WindowModeController;
		}),
);
