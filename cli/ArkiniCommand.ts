import { Command } from "@effect/cli";
import { DesktopCommand } from "./desktop/DesktopCommand";
import { GameCommand } from "~/engine/cli/GameCommand";

export const ArkiniCommand = Command.make("arkini")
	.pipe(
		Command.withSubcommands([
			GameCommand,
			DesktopCommand,
		]),
	)
	.pipe(Command.withDescription("Arkini development commands."));
