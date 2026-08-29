import { Effect, SubscriptionRef } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { ArkiniDefaultPackageId } from "../../../shared/ArkiniAppMetadata";
import type { WindowModeSchema } from "../../../electron/contract/window/WindowModeSchema";
import { ArkpackCatalogOwnerAtom } from "~/arkpack/renderer/ArkpackCatalogOwnerAtom";
import { WindowModeAtom } from "~/renderer/window/WindowModeAtom";
import { WindowModeReadyAtom } from "~/renderer/window/WindowModeReadyAtom";
import { readAppearanceAccentFx } from "~/ui/appearance/readAppearanceAccentFx";
import { readAppearanceThemeFx } from "~/ui/appearance/readAppearanceThemeFx";
import { AppearanceAtom } from "~/ui/appearance/AppearanceAtom";
import { applyCheatAvailabilityFx } from "~/ui/cheat-availability/applyCheatAvailabilityFx";
import { readCheatAvailabilityFx } from "~/ui/cheat-availability/readCheatAvailabilityFx";
import { RendererLifecycleOwnerAtom } from "~/renderer/lifecycle/RendererLifecycleOwnerAtom";
import { RendererLifecycleUnavailableError } from "~/renderer/lifecycle/RendererLifecycleUnavailableError";
import { readWindowModeFx } from "~/renderer/window/readWindowModeFx";
import { RendererAtomRuntime } from "~/renderer/RendererAtomRegistry";
import { LauncherHeroAtom } from "~/ui/launcher/LauncherHeroAtom";
import type { LauncherStartup } from "~/ui/launcher/LauncherStartup";
import { LauncherAppearanceReadyAtom } from "~/ui/launcher/LauncherAppearanceReadyAtom";
import { LauncherCheatAvailabilityReadyAtom } from "~/ui/launcher/LauncherCheatAvailabilityReadyAtom";
import { LauncherStartupConfigAtom } from "~/ui/launcher/LauncherStartupConfigAtom";

/** Publishes persisted appearance once without overwriting later user changes on retry. */
const applyLauncherAppearanceHydrationFx = Effect.fn("applyLauncherAppearanceHydrationFx")(
	(appearance: LauncherStartup.Appearance) =>
		Effect.uninterruptible(
			Effect.gen(function* () {
				if (yield* Atom.get(LauncherAppearanceReadyAtom)) return;
				yield* Atom.set(AppearanceAtom, appearance);
				yield* Atom.set(LauncherAppearanceReadyAtom, true);
			}),
		),
);

/** Completes the cheat preference readiness gate exactly once. */
const applyLauncherCheatAvailabilityHydrationFx = Effect.fn(
	"applyLauncherCheatAvailabilityHydrationFx",
)((available: boolean) =>
	Effect.uninterruptible(
		Effect.gen(function* () {
			if (yield* Atom.get(LauncherCheatAvailabilityReadyAtom)) return;
			yield* applyCheatAvailabilityFx(available);
			yield* Atom.set(LauncherCheatAvailabilityReadyAtom, true);
		}),
	),
);

/** Publishes persisted mode once without overwriting later native window events. */
const applyLauncherWindowModeHydrationFx = Effect.fn("applyLauncherWindowModeHydrationFx")(
	(mode: WindowModeSchema.Type) =>
		Effect.uninterruptible(
			Effect.gen(function* () {
				if (yield* Atom.get(WindowModeReadyAtom)) return;
				yield* Atom.set(WindowModeAtom, mode);
				yield* Atom.set(WindowModeReadyAtom, true);
			}),
		),
);

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
