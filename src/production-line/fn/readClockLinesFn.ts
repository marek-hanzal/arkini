import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { ScheduleStateSchema } from "~/item-schedule/schema/ScheduleStateSchema";

/** An absent override uses authored markers; an empty override disables every Clock line. */
export const readClockLinesFn = ({
	item,
	schedule,
}: {
	readonly item: ItemSchema.Type;
	readonly schedule: ScheduleStateSchema.Type | undefined;
}) =>
	item.lines.filter((line) =>
		schedule?.lineUids === undefined
			? line.clock === true
			: schedule.lineUids.includes(line.uid),
	);
