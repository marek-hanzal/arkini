import { Effect, Fiber, Option } from "effect";
import { readAppearanceAccentFx } from "~/bridge/appearance/readAppearanceAccentFx";
import { readAppearanceThemeFx } from "~/bridge/appearance/readAppearanceThemeFx";
import { readCheatAvailabilityFx } from "~/bridge/cheat/readCheatAvailabilityFx";
import { resolveBuiltInArkpackFx } from "~/bridge/arkpack/resolveBuiltInArkpackFx";
import type { LauncherStartup } from "~/ui/launcher/LauncherStartup";
import { prepareLauncherHeroFx } from "~/ui/launcher/prepareLauncherHeroFx";

/** Creates the one renderer-session startup bootstrap and splash completion owner. */
export const createLauncherStartupFx = Effect.fn("createLauncherStartupFx")(
	({ awaitPreviousShutdown, catalog, heroUrl, bootstrapFx }: LauncherStartup.Props) =>
		Effect.gen(function* () {
			const listeners = new Set<() => void | PromiseLike<void>>();
			const lock = yield* Effect.makeSemaphore(1);
			let started = false;
			let disposed = false;
			let activeFiber: Fiber.RuntimeFiber<void, unknown> | undefined;
			let currentHeroUrl = heroUrl;
			let ownedHeroUrl: string | undefined;
			let appearanceHydrationQueued = false;
			let cheatHydrationQueued = false;
			let pendingAppearance: LauncherStartup.Appearance | undefined;
			let pendingCheatsAvailable: boolean | undefined;
			let state: LauncherStartup.State = {
				type: "loading",
				appearanceReady: false,
				heroReady: false,
				splashCompleted: false,
			};

			const publish = (next: LauncherStartup.State) => {
				if (disposed) return;
				state = next;
				for (const listener of Array.from(listeners)) {
					try {
						const result = listener();
						if (result !== undefined)
							void Promise.resolve(result).catch(() => undefined);
					} catch {
						// Startup observers are presentation only and cannot stop bootstrap.
					}
				}
			};
			const queueAppearanceHydration = (appearance: LauncherStartup.Appearance) => {
				if (appearanceHydrationQueued) return;
				appearanceHydrationQueued = true;
				pendingAppearance = appearance;
				publish({
					...state,
				});
			};
			const queueCheatHydration = (cheatsAvailable: boolean) => {
				if (cheatHydrationQueued) return;
				cheatHydrationQueued = true;
				pendingCheatsAvailable = cheatsAvailable;
				publish({
					...state,
				});
			};

			const appearanceFx = Effect.all(
				{
					theme: readAppearanceThemeFx(),
					accent: readAppearanceAccentFx(),
				},
				{
					concurrency: "unbounded",
				},
			).pipe(
				Effect.tap((appearance) => Effect.sync(() => queueAppearanceHydration(appearance))),
			);
			const cheatAvailabilityFx = readCheatAvailabilityFx().pipe(
				Effect.tap((cheatsAvailable) =>
					Effect.sync(() => queueCheatHydration(cheatsAvailable)),
				),
			);
			const heroFx = Effect.uninterruptibleMask((restore) =>
				restore(
					prepareLauncherHeroFx({
						fallbackUrl: heroUrl,
					}),
				).pipe(
					Effect.flatMap((candidate) =>
						Effect.sync(() => {
							if (disposed) {
								if (candidate.owned) URL.revokeObjectURL(candidate.url);
								return;
							}
							if (ownedHeroUrl !== undefined && ownedHeroUrl !== candidate.url) {
								URL.revokeObjectURL(ownedHeroUrl);
							}
							ownedHeroUrl = candidate.owned ? candidate.url : undefined;
							currentHeroUrl = candidate.url;
							publish({
								...state,
								heroReady: true,
							});
						}),
					),
				),
			);
			const catalogFx = catalog.refreshFx.pipe(
				Effect.flatMap(() => {
					const snapshot = catalog.getSnapshot();
					return snapshot.type === "ready"
						? resolveBuiltInArkpackFx(snapshot.arkpacks)
						: Effect.fail(
								new Error("Arkpack catalog did not publish a ready snapshot."),
							);
				}),
			);
			const bridgeReadyFx = Effect.try({
				try: () => {
					if (window.arkini === undefined) {
						throw new Error("Arkini Electron preload API is unavailable.");
					}
				},
				catch: (cause) => cause,
			});
			const defaultBootstrapFx = Effect.all(
				{
					appearance: appearanceFx,
					builtIn: catalogFx,
					cheatsAvailable: cheatAvailabilityFx,
					bridge: bridgeReadyFx,
					hero: heroFx,
				},
				{
					concurrency: "unbounded",
				},
			).pipe(
				Effect.map(({ appearance, builtIn, cheatsAvailable }) => ({
					appearance,
					builtInPackageId: builtIn.packageId,
					cheatsAvailable,
				})),
			);
			const authoritativeBootstrapFx = bootstrapFx ?? defaultBootstrapFx;
			const awaitPreviousShutdownFx =
				awaitPreviousShutdown === undefined
					? Effect.void
					: Effect.tryPromise({
							try: () => awaitPreviousShutdown,
							catch: (cause) => cause,
						});

			const executeFx = Effect.gen(function* () {
				publish({
					type: "loading",
					appearanceReady: state.appearanceReady,
					heroReady: state.heroReady,
					splashCompleted: state.splashCompleted,
				});
				yield* awaitPreviousShutdownFx;
				const result = yield* authoritativeBootstrapFx;
				queueAppearanceHydration(result.appearance);
				queueCheatHydration(result.cheatsAvailable);
				publish({
					type: "ready",
					appearanceReady: state.appearanceReady,
					builtInPackageId: result.builtInPackageId,
					heroReady: true,
					splashCompleted: state.splashCompleted,
				});
			}).pipe(
				Effect.tapError((error) =>
					Effect.sync(() =>
						publish({
							type: "failed",
							appearanceReady: state.appearanceReady,
							error,
							heroReady: state.heroReady,
							splashCompleted: state.splashCompleted,
						}),
					),
				),
			);
			const runAttemptFx = (initial: boolean) =>
				Effect.gen(function* () {
					const fiber = yield* lock.withPermits(1)(
						Effect.gen(function* () {
							if (disposed) {
								return yield* Effect.fail(
									new Error("Launcher startup is disposed."),
								);
							}
							if (activeFiber !== undefined) {
								const activeExit = yield* Fiber.poll(activeFiber);
								if (Option.isNone(activeExit)) return activeFiber;
								activeFiber = undefined;
							}
							if (initial && started) return undefined;
							if (initial) started = true;
							activeFiber = yield* Effect.forkDaemon(executeFx);
							return activeFiber;
						}),
					);
					if (fiber === undefined) return;
					return yield* Fiber.join(fiber).pipe(
						Effect.ensuring(
							Fiber.poll(fiber).pipe(
								Effect.flatMap((exit) =>
									Option.isSome(exit)
										? lock.withPermits(1)(
												Effect.sync(() => {
													if (activeFiber === fiber)
														activeFiber = undefined;
												}),
											)
										: Effect.void,
								),
							),
						),
					);
				});
			const disposeFx = Effect.uninterruptible(
				lock.withPermits(1)(
					Effect.gen(function* () {
						if (disposed) return;
						disposed = true;
						const fiber = activeFiber;
						activeFiber = undefined;
						if (fiber !== undefined) yield* Fiber.interrupt(fiber);
						if (ownedHeroUrl !== undefined) URL.revokeObjectURL(ownedHeroUrl);
						ownedHeroUrl = undefined;
						pendingAppearance = undefined;
						pendingCheatsAvailable = undefined;
						currentHeroUrl = heroUrl;
						listeners.clear();
					}),
				),
			);

			return {
				getSnapshot: () => state,
				getHeroUrl: () => currentHeroUrl,
				consumeHydrationFx: (consume) =>
					Effect.sync(() => {
						if (
							disposed ||
							(pendingAppearance === undefined &&
								pendingCheatsAvailable === undefined)
						) {
							return false;
						}
						const appearance = pendingAppearance;
						const cheatsAvailable = pendingCheatsAvailable;
						pendingAppearance = undefined;
						pendingCheatsAvailable = undefined;
						try {
							consume({
								...(appearance === undefined
									? {}
									: {
											appearance,
										}),
								...(cheatsAvailable === undefined
									? {}
									: {
											cheatsAvailable,
										}),
							});
						} catch (error) {
							pendingAppearance = appearance;
							pendingCheatsAvailable = cheatsAvailable;
							throw error;
						}
						if (appearance !== undefined) {
							publish({
								...state,
								appearanceReady: true,
							});
						}
						return true;
					}),
				startFx: runAttemptFx(true),
				retryFx: runAttemptFx(false),
				completeSplashFx: Effect.sync(() => {
					if (disposed || state.splashCompleted) return;
					publish({
						...state,
						splashCompleted: true,
					});
				}),
				disposeFx,
				subscribe: (listener) => {
					if (disposed) return () => undefined;
					listeners.add(listener);
					return () => listeners.delete(listener);
				},
			} satisfies LauncherStartup;
		}),
);
