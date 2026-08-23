import { Effect } from "effect";
import { packOfficialArkiniFx } from "../arkpack/packOfficialArkiniFx";
import { buildDesktopOutputFx } from "./buildDesktopOutputFx";
import { packDemoGameFx } from "./packDemoGameFx";

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
	yield* buildDesktopOutputFx();
	yield* packOfficialArkiniFx({
		gameDirectory,
	});
	yield* packDemoGameFx({
		gameDirectory: demoDirectory,
	});
});
