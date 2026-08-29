import { Effect } from "effect";
import { WindowModeSchema } from "../../../electron/contract/window/WindowModeSchema";
import { RendererRuntime } from "~/renderer/RendererRuntime";
import { applyWindowModeFx } from "~/renderer/window/applyWindowModeFx";

/** Installs the process-lifetime renderer listener for Electron-confirmed mode changes. */
export const installWindowModeSyncFx = Effect.fn("installWindowModeSyncFx")(() =>
	Effect.sync(() =>
		window.arkini.window.onModeChanged((candidate) => {
			const mode = WindowModeSchema.parse(candidate);
			RendererRuntime.runSync(applyWindowModeFx(mode));
		}),
	),
);
