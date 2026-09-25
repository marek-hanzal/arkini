import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { ScheduleStateSchema } from "~/item-schedule/schema/ScheduleStateSchema";
import { LineClockModeEnumSchema } from "~/production-line/schema/LineClockModeEnumSchema";

/** An absent override uses authored markers; an empty override disables every Clock line. */
export const readClockLinesFn = ({
	item,
	schedule,
	role,
}: {
	readonly item: ItemSchema.Type;
	readonly schedule: ScheduleStateSchema.Type | undefined;
	readonly role: LineClockModeEnumSchema.Type;
}) =>
	item.lines.filter((line) =>
		role === LineClockModeEnumSchema.enum["clock-lifetime"]
			? line.clock === role
			: schedule?.lineUids === undefined
				? line.clock === role
				: line.clock !== LineClockModeEnumSchema.enum["clock-lifetime"] &&
					schedule.lineUids.includes(line.uid),
	);
