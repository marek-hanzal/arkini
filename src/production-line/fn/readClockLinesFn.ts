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
		schedule?.lineIds === undefined ? line.clock === true : schedule.lineIds.includes(line.id),
	);
