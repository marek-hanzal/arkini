import { Effect } from "effect";
import { buildDesktopOutputFx } from "./buildDesktopOutputFx";
import { runBuiltArkiniCliFx } from "./runBuiltArkiniCliFx";

export const buildDesktopFx = Effect.fn("buildDesktopFx")(function* () {
	yield* buildDesktopOutputFx();
	yield* runBuiltArkiniCliFx([
		"arkpack",
		"pack-official",
	]);
});
