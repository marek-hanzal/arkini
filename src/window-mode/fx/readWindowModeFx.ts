import { Effect } from "effect";
import { WindowModeSchema } from "../../../electron/contract/window/WindowModeSchema";

/** Reads and validates the persisted native window mode. */
export const readWindowModeFx = Effect.fn("readWindowModeFx")(() =>
	Effect.tryPromise({
		try: async () => WindowModeSchema.parse(await window.arkini.window.readMode()),
		catch: (cause) => cause,
	}),
);
