import { Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { WindowModeSchema } from "~electron/contract/window/WindowModeSchema";
import { WindowModeAtom } from "~/window-mode/atom/WindowModeAtom";
import { WindowModeReadyAtom } from "~/window-mode/atom/WindowModeReadyAtom";

/** Installs the process-lifetime renderer listener for Electron-confirmed mode changes. */
export const installWindowModeSyncFx = Effect.fn("installWindowModeSyncFx")(() =>
	Effect.map(AtomRegistry.AtomRegistry, (registry) =>
		window.arkini.window.onModeChanged((candidate) => {
			registry.set(WindowModeAtom, WindowModeSchema.parse(candidate));
			registry.set(WindowModeReadyAtom, true);
		}),
	),
);
