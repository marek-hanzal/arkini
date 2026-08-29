import { Command } from "effect/unstable/cli";

import { ArkpackCommand } from "~/arkpack/artifact/cli/ArkpackCommand";
import { GameCommand } from "./GameCommand";

/** Public command tree bundled with the game; repository desktop orchestration stays private. */
export const ArkiniCommand = Command.make("arkini-cli")
	.pipe(
		Command.withSubcommands([
			ArkpackCommand,
			GameCommand,
		]),
	)
	.pipe(Command.withDescription("Arkini game authoring and Arkpack commands."));
