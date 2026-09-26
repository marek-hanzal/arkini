import type { BoardRuntimeItemSchema } from "~/game-runtime/schema/BoardRuntimeItemSchema";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import type { JobSchema } from "~/production-job/schema/JobSchema";
import { readItemTerminalStateFn } from "~/item-terminal/fn/readItemTerminalStateFn";

/** A terminal line or self-depleting job removes its visible owner at completion. */
export const readJobOwnerExitFn = ({
	owner,
	line,
	job,
}: {
	readonly owner: BoardRuntimeItemSchema.Type;
	readonly line: LineSchema.Type;
	readonly job: JobSchema.Type;
}) => {
	if (line.trigger !== "item-termination" && job.terminalCause === undefined) return undefined;
	const terminal = readItemTerminalStateFn(owner);
	return terminal !== undefined
		? {
				cause: job.terminalCause ?? terminal.cause,
				overflow: terminal.mode === "kill-switch" ? ("discard" as const) : undefined,
			}
		: undefined;
};
