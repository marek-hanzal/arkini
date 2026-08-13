import { Command } from "effect/unstable/cli";

import { PlannerAuditCommand } from "./PlannerAuditCommand";

export const EditorCommand = Command.make("editor")
	.pipe(
		Command.withSubcommands([
			PlannerAuditCommand,
		]),
	)
	.pipe(Command.withDescription("Editor analysis and planner commands."));
