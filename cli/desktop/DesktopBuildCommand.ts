import { Command } from "@effect/cli";
import { buildDesktopFx } from "./buildDesktopFx";

export const DesktopBuildCommand = Command.make("build", {}, () => buildDesktopFx()).pipe(
	Command.withDescription("Build main, preload and renderer production output."),
);
