import { Command } from "effect/unstable/cli";

import { SerapackVerifyCommand } from "./SerapackVerifyCommand";

export const SerapackCommand = Command.make("serapack")
	.pipe(
		Command.withSubcommands([
			SerapackVerifyCommand,
		]),
	)
	.pipe(Command.withDescription("Offline Serapack release-provenance inspection."));
