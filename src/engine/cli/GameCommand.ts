import { Command } from "effect/unstable/cli";
import { PackCommand } from "~/engine/pack/cli/PackCommand";
import { SchemaCommand } from "~/engine/schema/cli/SchemaCommand";
import { ValidateCommand } from "~/engine/validation/cli/ValidateCommand";

export const GameCommand = Command.make("game")
	.pipe(
		Command.withSubcommands([
			PackCommand({
				input: "game/arkini",
				packageId: "arkini",
				version: "1.0",
			}),
			PackCommand({
				input: "game/demo",
				name: "pack-demo",
				packageId: "demo",
				version: "1.0",
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
