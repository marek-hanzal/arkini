import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { isItemProductionAdmissionOpenFn } from "~/production-line/fn/isItemProductionAdmissionOpenFn";
import { LineClockModeEnumSchema } from "~/production-line/schema/LineClockModeEnumSchema";

/** A lifetime line admits intent only at expiry; ordinary lines use the owner's open schedule. */
export const isLineAdmissionOpenFn = ({
	owner,
	lineUid,
	allowTerminalLine = true,
}: {
	readonly owner: RuntimeItemSchema.Type;
	readonly lineUid: IdSchema.Type;
	readonly allowTerminalLine?: boolean;
}): boolean => {
	const line = owner.item.lines.find((candidate) => candidate.uid === lineUid);
	return line?.clock === LineClockModeEnumSchema.enum["clock-lifetime"]
		? allowTerminalLine && owner.schedule?.remainingDurationMs === 0
		: isItemProductionAdmissionOpenFn(owner);
};
