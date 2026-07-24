import { Effect } from "effect";
import { buildDesktopOutputFx } from "./buildDesktopOutputFx";
import { packDemoGameFx } from "./packDemoGameFx";
import { packOfficialGameFx } from "./packOfficialGameFx";

export namespace buildDesktopFx {
	export interface Props {
		readonly demoDirectory?: string;
		readonly gameDirectory?: string;
	}
}

export const buildDesktopFx = Effect.fn("buildDesktopFx")(function* ({
	demoDirectory = "game/demo",
	gameDirectory = "game/arkini",
}: buildDesktopFx.Props = {}) {
	yield* packOfficialGameFx({
		gameDirectory,
	});
	yield* packDemoGameFx({
		gameDirectory: demoDirectory,
	});
	yield* buildDesktopOutputFx();
});
