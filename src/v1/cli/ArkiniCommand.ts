import { Command } from "@effect/cli";

import { SchemaCommand } from "~/v1/schema/cli/SchemaCommand";

/**
 * Root command for every Arkini development CLI operation.
 */
export const ArkiniCommand = Command.make("arkini")
	.pipe(
		Command.withSubcommands([
			SchemaCommand,
		]),
	)
	.pipe(Command.withDescription("Arkini development commands."));
