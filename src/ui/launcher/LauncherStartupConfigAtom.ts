import * as Atom from "effect/unstable/reactivity/Atom";
import type { LauncherStartup } from "~/ui/launcher/LauncherStartup";

/** The immutable renderer startup dependencies configured before React mounts. */
export const LauncherStartupConfigAtom = Atom.make<LauncherStartup.Props | undefined>(
	undefined,
).pipe(Atom.keepAlive);
