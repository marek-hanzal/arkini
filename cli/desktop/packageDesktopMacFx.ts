import { Effect } from "effect";
import { buildDesktopFx } from "./buildDesktopFx";
import { cleanDesktopPackagingFx } from "./cleanDesktopPackagingFx";
import { createDesktopChecksumsFx } from "./createDesktopChecksumsFx";
import { runDesktopCommandFx } from "./runDesktopCommandFx";
import { stageDesktopPackageFx } from "./stageDesktopPackageFx";
import { verifyDesktopArtifactsFx } from "./verifyDesktopArtifactsFx";

export namespace packageDesktopMacFx {
	export interface Props {
		readonly arch: "arm64";
	}
}

export const packageDesktopMacFx = Effect.fn("packageDesktopMacFx")(function* ({
	arch,
}: packageDesktopMacFx.Props) {
	yield* cleanDesktopPackagingFx();
	yield* buildDesktopFx();
	yield* stageDesktopPackageFx();
	yield* runDesktopCommandFx({
		command: "electron-builder",
		args: [
			"--config",
			"electron-builder.yml",
			"--mac",
			`--${arch}`,
			"--publish",
			"never",
		],
		operation: `package the unsigned macOS ${arch} application`,
	});
	yield* createDesktopChecksumsFx();
	yield* verifyDesktopArtifactsFx();
});
