import type { BoardRuntimeItemSchema } from "~/game-runtime/schema/BoardRuntimeItemSchema";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import { LineClockModeEnumSchema } from "~/production-line/schema/LineClockModeEnumSchema";

/** A completed lifetime line removes its owner with the schedule's placement policy. */
export const readScheduledLineOwnerExitFn = ({
	owner,
	line,
}: {
	readonly owner: BoardRuntimeItemSchema.Type;
	readonly line: LineSchema.Type;
}) =>
	line.clock === LineClockModeEnumSchema.enum["clock-lifetime"] &&
	owner.schedule?.remainingDurationMs === 0
		? {
				cause: "expired" as const,
				overflow:
					owner.item.clock?.expiryMode === "kill-switch"
						? ("discard" as const)
						: undefined,
			}
		: undefined;
