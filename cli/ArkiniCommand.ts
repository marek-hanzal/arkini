import { Command } from "@effect/cli";
import { ArkpackCommand } from "./arkpack/ArkpackCommand";
import { DesktopCommand } from "./desktop/DesktopCommand";
import { GameCommand } from "~/engine/cli/GameCommand";

export const ArkiniCommand = Command.make("arkini")
	.pipe(
		Command.withSubcommands([
			ArkpackCommand,
			GameCommand,
			DesktopCommand,
		]),
	)
	.pipe(Command.withDescription("Arkini development commands."));
