import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { isItemProductionAdmissionOpenFn } from "~/production-line/fn/isItemProductionAdmissionOpenFn";
import { LineTriggerEnumSchema } from "~/production-line/schema/LineTriggerEnumSchema";
import { readItemTerminalStateFn } from "~/item-terminal/fn/readItemTerminalStateFn";

/** A termination line admits intent only once its owner has ended. */
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
	if (line === undefined) return false;
	if (line.trigger === LineTriggerEnumSchema.enum["item-termination"])
		return allowTerminalLine && readItemTerminalStateFn(owner) !== undefined;
	return isItemProductionAdmissionOpenFn(owner);
};
