import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { ItemScheduleSchema } from "~/item-schedule/schema/ItemScheduleSchema";

/** Reads the authored scheduling capability without introducing another owner registry. */
export const readItemScheduleFn = (item: ItemSchema.Type): ItemScheduleSchema.Type | undefined =>
	"intervalMs" in item ? item : undefined;
