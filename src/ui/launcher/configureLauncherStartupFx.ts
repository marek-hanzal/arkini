import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { LauncherStartup } from "~/ui/launcher/LauncherStartup";
import { LauncherStartupConfigAtom } from "~/ui/launcher/LauncherStartupConfigAtom";

/** Configures the renderer startup dependencies before the React tree mounts. */
export const configureLauncherStartupFx = Effect.fn("configureLauncherStartupFx")(
	(props: LauncherStartup.Props) => Atom.set(LauncherStartupConfigAtom, props),
);
