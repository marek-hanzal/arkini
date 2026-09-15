import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { RendererAtomRuntime } from "~/application-runtime/atom/RendererAtomRegistry";
import { LauncherStartupConfigAtom } from "~/launcher/atom/LauncherStartupConfigAtom";
import { prepareLauncherHeroFx } from "~/launcher/fx/prepareLauncherHeroFx";

/** Resolves and preloads the selected installed Hero URL for one attempt. */
export const LauncherHeroAtom = RendererAtomRuntime.atom((get) => {
	const config = get(LauncherStartupConfigAtom);
	if (config === undefined) {
		return Effect.fail(new Error("Launcher startup is not configured."));
	}
	if (config.bootstrapFx !== undefined) {
		return Effect.succeed({
			url: config.heroUrl,
		});
	}
	return prepareLauncherHeroFx({
		fallbackUrl: config.heroUrl,
	});
}).pipe(Atom.keepAlive);
