import { Effect } from "effect";
import { buildDesktopOutputFx } from "./buildDesktopOutputFx";
import { packOfficialGameFx } from "./packOfficialGameFx";

export namespace buildDesktopFx {
	export interface Props {
		readonly gameDirectory?: string;
	}
}

export const buildDesktopFx = Effect.fn("buildDesktopFx")(function* ({
	gameDirectory = "game/arkini",
}: buildDesktopFx.Props = {}) {
	yield* packOfficialGameFx({
		gameDirectory,
	});
	yield* buildDesktopOutputFx();
});
