import { Effect } from "effect";
import { buildDesktopFx } from "./buildDesktopFx";
import { cleanDesktopPackagingFx } from "./cleanDesktopPackagingFx";
import { createDesktopChecksumsFx } from "./createDesktopChecksumsFx";
import { packageDesktopMacArtifactsFx } from "./packageDesktopMacArtifactsFx";
import { stageDesktopPackageFx } from "./stageDesktopPackageFx";
import { verifyDesktopPackageStructureFx } from "./verifyDesktopPackageStructureFx";

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
	yield* packageDesktopMacArtifactsFx({
		arch,
	});
	yield* createDesktopChecksumsFx();
	yield* verifyDesktopPackageStructureFx();
});
