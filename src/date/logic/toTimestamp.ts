import type { DateTime } from "luxon";

export function toTimestamp(date: DateTime) {
	return (
		date.toUTC().toISO({
			suppressMilliseconds: false,
		}) ?? date.toJSDate().toISOString()
	);
}
