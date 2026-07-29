import type { Effect } from "effect";
import type { WindowModeSchema } from "../../contract/window/WindowModeSchema";

/** Sole per-BrowserWindow authority for requested and Electron-confirmed native modes. */
export interface WindowModeController {
	readonly requestModeFx: (mode: WindowModeSchema.Type) => Effect.Effect<void, unknown>;
}
