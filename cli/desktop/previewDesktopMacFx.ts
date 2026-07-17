import { Console, Effect } from "effect";
import { buildDesktopFx } from "./buildDesktopFx";
import { cleanDesktopPackagingFx } from "./cleanDesktopPackagingFx";
import { createUnpackedMacAppFx } from "./createUnpackedMacAppFx";
import { openMacAppFx } from "./openMacAppFx";
import { stageDesktopPackageFx } from "./stageDesktopPackageFx";

export const previewDesktopMacFx = Effect.fn("previewDesktopMacFx")(function* () {
	yield* cleanDesktopPackagingFx();
	yield* buildDesktopFx();
	yield* stageDesktopPackageFx();
	const appPath = yield* createUnpackedMacAppFx({
		arch: "arm64",
	});
	yield* Console.log(`Created unpacked macOS application: ${appPath}`);
	yield* openMacAppFx({
		appPath,
	});
});
