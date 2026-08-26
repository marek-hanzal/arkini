import { Command } from "effect/unstable/cli";

import { ArkpackKeygenCommand } from "./ArkpackKeygenCommand";
import { ArkpackSignCommand } from "./ArkpackSignCommand";
import { ArkpackVerifyCommand } from "./ArkpackVerifyCommand";

export const ArkpackCommand = Command.make("arkpack")
	.pipe(
		Command.withSubcommands([
			ArkpackKeygenCommand,
			ArkpackSignCommand,
			ArkpackVerifyCommand,
		]),
	)
	.pipe(Command.withDescription("Arkpack authenticity and maintainer commands."));
