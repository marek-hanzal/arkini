import { Effect } from "effect";
import { WindowModeSchema } from "../../../electron/contract/window/WindowModeSchema";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { applyWindowModeFx } from "~/bridge/window/applyWindowModeFx";

/** Installs the process-lifetime renderer listener for Electron-confirmed mode changes. */
export const installWindowModeSyncFx = Effect.fn("installWindowModeSyncFx")(() =>
	Effect.sync(() =>
		window.arkini.window.onModeChanged((candidate) => {
			const mode = WindowModeSchema.parse(candidate);
			RendererRuntime.runSync(applyWindowModeFx(mode));
		}),
	),
);
