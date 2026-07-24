import { Command } from "effect/unstable/cli";
import { stageDesktopPackageFx } from "./stageDesktopPackageFx";

export const DesktopStageCommand = Command.make("stage", {}, () => stageDesktopPackageFx()).pipe(
	Command.withDescription("Stage only production Electron output for packaging."),
);
