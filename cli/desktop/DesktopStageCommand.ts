import { Command } from "@effect/cli";
import { stageDesktopPackageFx } from "./stageDesktopPackageFx";

export const DesktopStageCommand = Command.make("stage", {}, () => stageDesktopPackageFx()).pipe(
	Command.withDescription("Stage only production Electron output for packaging."),
);
