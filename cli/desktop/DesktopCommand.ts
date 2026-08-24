import { Command } from "effect/unstable/cli";
import { DesktopBuildCommand } from "./DesktopBuildCommand";
import { DesktopPackageCommand } from "./DesktopPackageCommand";
import { DesktopPreviewMacosCommand } from "./DesktopPreviewMacosCommand";
import { DesktopVerifyCommand } from "./DesktopVerifyCommand";

export const DesktopCommand = Command.make("desktop")
	.pipe(
		Command.withSubcommands([
			DesktopBuildCommand,
			DesktopPackageCommand,
			DesktopPreviewMacosCommand,
			DesktopVerifyCommand,
		]),
	)
	.pipe(Command.withDescription("Electron build, package and artifact commands."));
