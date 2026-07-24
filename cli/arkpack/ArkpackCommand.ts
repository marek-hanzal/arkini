import { Command } from "@effect/cli";

import { ArkpackKeygenCommand } from "./ArkpackKeygenCommand";
import { ArkpackOfficialPackCommand } from "./ArkpackOfficialPackCommand";
import { ArkpackSignCommand } from "./ArkpackSignCommand";
import { ArkpackVerifyCommand } from "./ArkpackVerifyCommand";

export const ArkpackCommand = Command.make("arkpack")
	.pipe(
		Command.withSubcommands([
			ArkpackKeygenCommand,
			ArkpackOfficialPackCommand,
			ArkpackSignCommand,
			ArkpackVerifyCommand,
		]),
	)
	.pipe(Command.withDescription("Arkpack authenticity and maintainer commands."));
