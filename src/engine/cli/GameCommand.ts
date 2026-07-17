import { Command } from "@effect/cli";
import { PackCommand } from "~/engine/pack/cli/PackCommand";
import { SchemaCommand } from "~/engine/schema/cli/SchemaCommand";
import { ValidateCommand } from "~/engine/validation/cli/ValidateCommand";

export const GameCommand = Command.make("game")
	.pipe(
		Command.withSubcommands([
			PackCommand({
				input: "game/arkini",
				metadata: {
					output: "game/arkini.game.arkpack.metadata.json",
					packageId: "arkini",
				},
			}),
			SchemaCommand({
				output: "game/schema.json",
			}),
			ValidateCommand({
				input: "game/arkini",
			}),
		]),
	)
	.pipe(Command.withDescription("Game authoring, validation and package commands."));
