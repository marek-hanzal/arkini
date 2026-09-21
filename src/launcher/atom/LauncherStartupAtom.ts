import { Effect, SubscriptionRef } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { SerakkiDefaultPackageId } from "~shared/SerakkiAppMetadata";
import type { WindowModeSchema } from "~electron/contract/window/WindowModeSchema";
import { SerapackCatalogOwnerAtom } from "~/serapack-catalog/atom/SerapackCatalogOwnerAtom";
import { WindowModeAtom } from "~/window-mode/atom/WindowModeAtom";
import { WindowModeReadyAtom } from "~/window-mode/atom/WindowModeReadyAtom";
import { readAppearanceAccentFx } from "~/application-settings/fx/readAppearanceAccentFx";
import { readAppearanceThemeFx } from "~/application-settings/fx/readAppearanceThemeFx";
import { AppearanceAtom } from "~/application-settings/atom/AppearanceAtom";
import { applyCheatAvailabilityFx } from "~/application-settings/fx/applyCheatAvailabilityFx";
import { readCheatAvailabilityFx } from "~/application-settings/fx/readCheatAvailabilityFx";
import { RendererLifecycleOwnerAtom } from "~/application-runtime/atom/RendererLifecycleOwnerAtom";
import { RendererLifecycleUnavailableError } from "~/application-runtime/error/RendererLifecycleUnavailableError";
import { readWindowModeFx } from "~/window-mode/fx/readWindowModeFx";
import { RendererAtomRuntime } from "~/application-runtime/atom/RendererAtomRegistry";
import { LauncherHeroAtom } from "~/launcher/atom/LauncherHeroAtom";
import type { LauncherStartup } from "~/launcher/type/LauncherStartup";
import { LauncherAppearanceReadyAtom } from "~/launcher/atom/LauncherAppearanceReadyAtom";
import { LauncherCheatAvailabilityReadyAtom } from "~/launcher/atom/LauncherCheatAvailabilityReadyAtom";
import { LauncherStartupConfigAtom } from "~/launcher/atom/LauncherStartupConfigAtom";
import { SoundSettingsAtom } from "~/application-settings/atom/SoundSettingsAtom";
import { defaultSoundSettings } from "~electron/contract/sound/SoundSettings";
import { writeApplicationLogFx } from "~/application-diagnostics/fx/writeApplicationLogFx";
import { formatApplicationDiagnosticTextFn } from "~/application-diagnostics/fn/formatApplicationDiagnosticTextFn";
import { readSoundSettingsFx } from "~/application-settings/fx/readSoundSettingsFx";

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
	const catalog = get(SerapackCatalogOwnerAtom);
	if (catalog === undefined) {
		return Effect.fail(new Error("Serapack catalog is not configured."));
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
	const soundFx = readSoundSettingsFx().pipe(
		Effect.catch((cause) =>
			writeApplicationLogFx({
				level: "warning",
				message: "Sound preferences could not be loaded; using defaults",
				body: formatApplicationDiagnosticTextFn({
					value: cause,
				}),
			}).pipe(Effect.as(defaultSoundSettings)),
		),
		Effect.tap((sound) => Atom.set(SoundSettingsAtom, sound)),
	);
	const catalogFx = catalog.refreshFx.pipe(
		Effect.andThen(SubscriptionRef.get(catalog.state)),
		Effect.flatMap((state) =>
			state.type === "ready"
				? Effect.void
				: Effect.fail(new Error("Serapack catalog did not publish a ready snapshot.")),
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
			sound: soundFx,
			windowMode: windowModeFx,
		},
		{
			concurrency: "unbounded",
		},
	).pipe(
		Effect.map(({ appearance, cheatsAvailable, sound, windowMode }) => ({
			appearance,
			defaultPackageId: SerakkiDefaultPackageId,
			cheatsAvailable,
			sound,
			windowMode,
		})),
	);

	return (config.bootstrapFx ?? defaultBootstrapFx).pipe(
		Effect.tap((result) =>
			Effect.all(
				[
					applyLauncherAppearanceHydrationFx(result.appearance),
					applyLauncherCheatAvailabilityHydrationFx(result.cheatsAvailable),
					Atom.set(SoundSettingsAtom, result.sound),
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
