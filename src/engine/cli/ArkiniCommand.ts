import { Command } from "@effect/cli";

import { PackCommand } from "~/engine/pack/cli/PackCommand";
import { SchemaCommand } from "~/engine/schema/cli/SchemaCommand";
import { ValidateCommand } from "~/engine/validation/cli/ValidateCommand";

/**
 * Root command for every Arkini development CLI operation.
 */
export const ArkiniCommand = Command.make("arkini")
	.pipe(
		Command.withSubcommands([
			PackCommand({
				input: "game/arkini",
			}),
			SchemaCommand({
				output: "game/schema.json",
			}),
			ValidateCommand({
				input: "game/arkini",
			}),
		]),
	)
	.pipe(Command.withDescription("Arkini development commands."));
