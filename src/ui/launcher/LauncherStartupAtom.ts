import { Effect, SubscriptionRef } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { ArkpackCatalogOwnerAtom } from "~/bridge/arkpack/ArkpackCatalogOwnerAtom";
import { resolveBuiltInArkpackFx } from "~/bridge/arkpack/resolveBuiltInArkpackFx";
import { readAppearanceAccentFx } from "~/bridge/appearance/readAppearanceAccentFx";
import { readAppearanceThemeFx } from "~/bridge/appearance/readAppearanceThemeFx";
import { readCheatAvailabilityFx } from "~/bridge/cheat/readCheatAvailabilityFx";
import { RendererAtomRuntime } from "~/bridge/reactivity/RendererAtomRegistry";
import { applyLauncherAppearanceHydrationFx } from "~/ui/launcher/applyLauncherAppearanceHydrationFx";
import { applyLauncherCheatAvailabilityHydrationFx } from "~/ui/launcher/applyLauncherCheatAvailabilityHydrationFx";
import { LauncherHeroAtom } from "~/ui/launcher/LauncherHeroAtom";
import { LauncherStartupConfigAtom } from "~/ui/launcher/LauncherStartupConfigAtom";

/**
 * The authoritative launcher bootstrap AsyncResult.
 *
 * Appearance and cheat preferences publish as soon as their reads complete;
 * the final success still waits for every required bootstrap branch.
 */
export const LauncherStartupAtom = RendererAtomRuntime.atom((get) => {
	const config = get(LauncherStartupConfigAtom);
	if (config === undefined) {
		return Effect.fail(new Error("Launcher startup is not configured."));
	}
	const catalog = get(ArkpackCatalogOwnerAtom);
	if (catalog === undefined) {
		return Effect.fail(new Error("Arkpack catalog is not configured."));
	}

	const appearanceFx = Effect.all(
		{
			theme: readAppearanceThemeFx(),
			accent: readAppearanceAccentFx(),
		},
		{
			concurrency: "unbounded",
		},
	).pipe(Effect.tap(applyLauncherAppearanceHydrationFx));
	const cheatAvailabilityFx = readCheatAvailabilityFx().pipe(
		Effect.tap(applyLauncherCheatAvailabilityHydrationFx),
	);
	const catalogFx = catalog.refreshFx.pipe(
		Effect.andThen(SubscriptionRef.get(catalog.state)),
		Effect.flatMap((state) =>
			state.type === "ready"
				? resolveBuiltInArkpackFx(state.arkpacks)
				: Effect.fail(new Error("Arkpack catalog did not publish a ready snapshot.")),
		),
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
			hero: Atom.getResult(LauncherHeroAtom, {
				suspendOnWaiting: true,
			}),
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

	return (config.bootstrapFx ?? defaultBootstrapFx).pipe(
		Effect.tap((result) =>
			Effect.all(
				[
					applyLauncherAppearanceHydrationFx(result.appearance),
					applyLauncherCheatAvailabilityHydrationFx(result.cheatsAvailable),
					Atom.getResult(LauncherHeroAtom, {
						suspendOnWaiting: true,
					}),
				],
				{
					concurrency: "unbounded",
					discard: true,
				},
			),
		),
	);
}).pipe(Atom.keepAlive);
