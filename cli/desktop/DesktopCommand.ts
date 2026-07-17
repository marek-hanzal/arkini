import { Command } from "@effect/cli";
import { DesktopBuildCommand } from "./DesktopBuildCommand";
import { DesktopChecksumsCommand } from "./DesktopChecksumsCommand";
import { DesktopCleanCommand } from "./DesktopCleanCommand";
import { DesktopPackageCommand } from "./DesktopPackageCommand";
import { DesktopStageCommand } from "./DesktopStageCommand";
import { DesktopVerifyCommand } from "./DesktopVerifyCommand";

export const DesktopCommand = Command.make("desktop")
	.pipe(
		Command.withSubcommands([
			DesktopBuildCommand,
			DesktopCleanCommand,
			DesktopStageCommand,
			DesktopPackageCommand,
			DesktopChecksumsCommand,
			DesktopVerifyCommand,
		]),
	)
	.pipe(Command.withDescription("Electron build, package and artifact commands."));
