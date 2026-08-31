import * as Atom from "effect/unstable/reactivity/Atom";
import type { LauncherStartup } from "~/launcher/type/LauncherStartup";

/** Application-shell fallback shown until package-owned Hero artwork is ready. */
export const LauncherHeroAsset = {
	url: "/hero.png",
} as const;

/** The immutable renderer startup dependencies configured before React mounts. */
export const LauncherStartupConfigAtom = Atom.make<LauncherStartup.Props | undefined>(
	undefined,
).pipe(Atom.keepAlive);
