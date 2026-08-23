import { Effect, SubscriptionRef } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { ArkiniDefaultPackageId } from "../../../shared/ArkiniAppMetadata";
import { ArkpackCatalogOwnerAtom } from "~/bridge/arkpack/ArkpackCatalogOwnerAtom";
import { readAppearanceAccentFx } from "~/bridge/appearance/readAppearanceAccentFx";
import { readAppearanceThemeFx } from "~/bridge/appearance/readAppearanceThemeFx";
import { readCheatAvailabilityFx } from "~/bridge/cheat/readCheatAvailabilityFx";
import { RendererLifecycleOwnerAtom } from "~/bridge/lifecycle/RendererLifecycleOwnerAtom";
import { RendererLifecycleUnavailableError } from "~/bridge/lifecycle/RendererLifecycleUnavailableError";
import { readWindowModeFx } from "~/bridge/window/readWindowModeFx";
import { RendererAtomRuntime } from "~/bridge/reactivity/RendererAtomRegistry";
import { applyLauncherAppearanceHydrationFx } from "~/ui/launcher/applyLauncherAppearanceHydrationFx";
import { applyLauncherCheatAvailabilityHydrationFx } from "~/ui/launcher/applyLauncherCheatAvailabilityHydrationFx";
import { applyLauncherWindowModeHydrationFx } from "~/ui/launcher/applyLauncherWindowModeHydrationFx";
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
	const windowModeFx = readWindowModeFx().pipe(Effect.tap(applyLauncherWindowModeHydrationFx));
	const catalogFx = catalog.refreshFx.pipe(
		Effect.andThen(SubscriptionRef.get(catalog.state)),
		Effect.flatMap((state) =>
			state.type === "ready"
				? Effect.void
				: Effect.fail(new Error("Arkpack catalog did not publish a ready snapshot.")),
		),
	);
	const lifecycleReadyFx =
		get(RendererLifecycleOwnerAtom) === undefined
			? Effect.fail(new RendererLifecycleUnavailableError())
			: Effect.void;
	const defaultBootstrapFx = Effect.all(
		{
			appearance: appearanceFx,
			catalog: catalogFx,
			cheatsAvailable: cheatAvailabilityFx,
			hero: Atom.getResult(LauncherHeroAtom, {
				suspendOnWaiting: true,
			}),
			lifecycle: lifecycleReadyFx,
			windowMode: windowModeFx,
		},
		{
			concurrency: "unbounded",
		},
	).pipe(
		Effect.map(({ appearance, cheatsAvailable, windowMode }) => ({
			appearance,
			defaultPackageId: ArkiniDefaultPackageId,
			cheatsAvailable,
			windowMode,
		})),
	);

	return (config.bootstrapFx ?? defaultBootstrapFx).pipe(
		Effect.tap((result) =>
			Effect.all(
				[
					applyLauncherAppearanceHydrationFx(result.appearance),
					applyLauncherCheatAvailabilityHydrationFx(result.cheatsAvailable),
					applyLauncherWindowModeHydrationFx(result.windowMode),
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
