import { Effect } from "effect";
import { readAppearanceAccentFx } from "~/bridge/appearance/readAppearanceAccentFx";
import { readAppearanceThemeFx } from "~/bridge/appearance/readAppearanceThemeFx";
import { resolveBuiltInArkpackFx } from "~/bridge/arkpack/resolveBuiltInArkpackFx";
import type { LauncherStartup } from "~/ui/launcher/LauncherStartup";
import { preloadLauncherHeroFx } from "~/ui/launcher/preloadLauncherHeroFx";

/** Creates the one renderer-session startup bootstrap and splash completion owner. */
export const createLauncherStartupFx = Effect.fn("createLauncherStartupFx")(
	({ catalog, heroUrl, bootstrapFx }: LauncherStartup.Props) =>
		Effect.gen(function* () {
			const listeners = new Set<() => void | PromiseLike<void>>();
			const lock = yield* Effect.makeSemaphore(1);
			let started = false;
			let state: LauncherStartup.State = {
				type: "loading",
				appearance: null,
				heroReady: false,
				splashCompleted: false,
			};

			const publish = (next: LauncherStartup.State) => {
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

			const appearanceFx = Effect.all(
				{
					theme: readAppearanceThemeFx(),
					accent: readAppearanceAccentFx(),
				},
				{
					concurrency: "unbounded",
				},
			).pipe(
				Effect.tap((appearance) =>
					Effect.sync(() =>
						publish({
							type: "loading",
							appearance,
							heroReady: state.heroReady,
							splashCompleted: state.splashCompleted,
						}),
					),
				),
			);
			const heroFx = preloadLauncherHeroFx({
				url: heroUrl,
			}).pipe(
				Effect.tap(() =>
					Effect.sync(() =>
						publish({
							...state,
							heroReady: true,
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
					bridge: bridgeReadyFx,
					hero: heroFx,
				},
				{
					concurrency: "unbounded",
				},
			).pipe(
				Effect.map(({ appearance, builtIn }) => ({
					appearance,
					builtInPackageId: builtIn.packageId,
				})),
			);
			const authoritativeBootstrapFx = bootstrapFx ?? defaultBootstrapFx;

			const executeFx = Effect.gen(function* () {
				publish({
					type: "loading",
					appearance: state.appearance,
					heroReady: state.heroReady,
					splashCompleted: state.splashCompleted,
				});
				const result = yield* authoritativeBootstrapFx;
				publish({
					type: "ready",
					appearance: result.appearance,
					builtInPackageId: result.builtInPackageId,
					heroReady: true,
					splashCompleted: state.splashCompleted,
				});
			}).pipe(
				Effect.tapError((error) =>
					Effect.sync(() =>
						publish({
							type: "failed",
							appearance: state.appearance,
							error,
							heroReady: state.heroReady,
							splashCompleted: state.splashCompleted,
						}),
					),
				),
			);

			return {
				getSnapshot: () => state,
				startFx: lock.withPermits(1)(
					Effect.gen(function* () {
						if (started) return;
						started = true;
						yield* executeFx;
					}),
				),
				retryFx: lock.withPermits(1)(executeFx),
				completeSplashFx: Effect.sync(() => {
					if (state.splashCompleted) return;
					publish({
						...state,
						splashCompleted: true,
					});
				}),
				subscribe: (listener) => {
					listeners.add(listener);
					return () => listeners.delete(listener);
				},
			} satisfies LauncherStartup;
		}),
);
