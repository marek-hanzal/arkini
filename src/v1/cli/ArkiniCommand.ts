import { Command } from "@effect/cli";

import { PackCommand } from "~/v1/pack/cli/PackCommand";
import { SchemaCommand } from "~/v1/schema/cli/SchemaCommand";

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
		]),
	)
	.pipe(Command.withDescription("Arkini development commands."));
