import { Command } from "effect/unstable/cli";

import { ArkpackVerifyCommand } from "./ArkpackVerifyCommand";

export const ArkpackCommand = Command.make("arkpack")
	.pipe(
		Command.withSubcommands([
			ArkpackVerifyCommand,
		]),
	)
	.pipe(Command.withDescription("Offline Arkpack release-provenance inspection."));
