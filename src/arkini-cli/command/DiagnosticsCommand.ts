import { Command } from "effect/unstable/cli";

import { DiagnosticsSliceCommand } from "./DiagnosticsSliceCommand";

export const DiagnosticsCommand = Command.make("diagnostics")
	.pipe(
		Command.withSubcommands([
			DiagnosticsSliceCommand,
		]),
	)
	.pipe(Command.withDescription("Local application and incident diagnostic tools."));
