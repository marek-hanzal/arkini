import type { BoardRuntimeItemSchema } from "~/game-runtime/schema/BoardRuntimeItemSchema";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import { readItemTerminalStateFn } from "~/item-terminal/fn/readItemTerminalStateFn";

/** A completed terminal line removes its owner with the selected terminal policy. */
export const readTerminalLineOwnerExitFn = ({
	owner,
	line,
}: {
	readonly owner: BoardRuntimeItemSchema.Type;
	readonly line: LineSchema.Type;
}) => {
	if (line.trigger !== "item-termination") return undefined;
	const terminal = readItemTerminalStateFn(owner);
	return terminal !== undefined
		? {
				cause: terminal.cause,
				overflow: terminal.mode === "kill-switch" ? ("discard" as const) : undefined,
			}
		: undefined;
};
