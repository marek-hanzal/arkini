import { Effect, SubscriptionRef } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { SerakkiDefaultPackageId } from "~shared/SerakkiAppMetadata";
import type { WindowModeSchema } from "~electron/contract/window/WindowModeSchema";
import { SerapackCatalogOwnerAtom } from "~/serapack-catalog/atom/SerapackCatalogOwnerAtom";
import { WindowModeAtom } from "~/window-mode/atom/WindowModeAtom";
import { WindowModeReadyAtom } from "~/window-mode/atom/WindowModeReadyAtom";
import { readAppearanceAccentFx } from "~/application-settings/fx/readAppearanceAccentFx";
import type { AppearanceAccentSchema } from "~electron/contract/appearance/AppearanceAccentSchema";
import { AccentAtom } from "~/application-settings/atom/AccentAtom";
import { applyCheatAvailabilityFx } from "~/application-settings/fx/applyCheatAvailabilityFx";
import { readCheatAvailabilityFx } from "~/application-settings/fx/readCheatAvailabilityFx";
import { RendererLifecycleOwnerAtom } from "~/application-runtime/atom/RendererLifecycleOwnerAtom";
import { RendererLifecycleUnavailableError } from "~/application-runtime/error/RendererLifecycleUnavailableError";
import { readWindowModeFx } from "~/window-mode/fx/readWindowModeFx";
import { RendererAtomRuntime } from "~/application-runtime/atom/RendererAtomRegistry";
import { LauncherHeroAtom } from "~/launcher/atom/LauncherHeroAtom";
import { LauncherAccentReadyAtom } from "~/launcher/atom/LauncherAccentReadyAtom";
import { LauncherCheatAvailabilityReadyAtom } from "~/launcher/atom/LauncherCheatAvailabilityReadyAtom";
import { LauncherStartupConfigAtom } from "~/launcher/atom/LauncherStartupConfigAtom";
import { SoundSettingsAtom } from "~/application-settings/atom/SoundSettingsAtom";
import { defaultSoundSettings } from "~electron/contract/sound/SoundSettings";
import { writeApplicationLogFx } from "~/application-diagnostics/fx/writeApplicationLogFx";
import { formatApplicationDiagnosticTextFn } from "~/application-diagnostics/fn/formatApplicationDiagnosticTextFn";
import { readSoundSettingsFx } from "~/application-settings/fx/readSoundSettingsFx";

/** Publishes the persisted accent once without overwriting later user changes on retry. */
const applyLauncherAccentHydrationFx = Effect.fn("applyLauncherAccentHydrationFx")(
	(accent: AppearanceAccentSchema.Type) =>
		Effect.uninterruptible(
			Effect.gen(function* () {
				if (yield* Atom.get(LauncherAccentReadyAtom)) return;
				yield* Atom.set(AccentAtom, accent);
				yield* Atom.set(LauncherAccentReadyAtom, true);
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
 * Accent and cheat preferences publish as soon as their reads complete;
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

	const accentFx = readAppearanceAccentFx().pipe(Effect.tap(applyLauncherAccentHydrationFx));
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
			accent: accentFx,
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
		Effect.map(({ accent, cheatsAvailable, sound, windowMode }) => ({
			accent,
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
					applyLauncherAccentHydrationFx(result.accent),
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
