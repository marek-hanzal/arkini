import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import {
	LauncherHeroAsset,
	LauncherStartupConfigAtom,
} from "~/launcher/atom/LauncherStartupConfigAtom";

/** Publishes immutable Launcher dependencies before its root hydrator mounts. */
export const bootstrapLauncherFx = Effect.fn("bootstrapLauncherFx")(() =>
	Atom.set(LauncherStartupConfigAtom, {
		heroUrl: LauncherHeroAsset.url,
	}),
);
