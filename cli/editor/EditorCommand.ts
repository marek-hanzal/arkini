import { Command } from "effect/unstable/cli";

import { PlannerAuditCommand } from "./PlannerAuditCommand";
import { PlannerAuditMergeCommand } from "./PlannerAuditMergeCommand";

export const EditorCommand = Command.make("editor")
	.pipe(
		Command.withSubcommands([
			PlannerAuditCommand,
			PlannerAuditMergeCommand,
		]),
	)
	.pipe(Command.withDescription("Editor analysis and planner commands."));
