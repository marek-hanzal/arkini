import { Command } from "effect/unstable/cli";
import { PackCommand } from "~/arkpack/artifact/cli/PackCommand";
import { SchemaCommand } from "~/game-config/cli/SchemaCommand";
import { ValidateCommand } from "~/game-config/cli/ValidateCommand";

export const GameCommand = Command.make("game")
	.pipe(
		Command.withSubcommands([
			PackCommand({
				input: "game/arkini",
			}),
			SchemaCommand({
				output: "game/arkini/schema.json",
			}),
			ValidateCommand({
				input: "game/arkini",
			}),
		]),
	)
	.pipe(Command.withDescription("Game authoring, validation and package commands."));
