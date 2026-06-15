import { DateTime } from "luxon";
import type { DateService } from "~/v0/date/context/DateServiceFx";
import { toTimestamp } from "~/v0/date/logic/toTimestamp";

export const DateServiceLive: DateService = {
	now() {
		return DateTime.now();
	},
	nowMs() {
		return DateTime.now().toMillis();
	},
	timestamp() {
		return toTimestamp(DateTime.now());
	},
	toTimestamp,
	parseTimestampMs(value) {
		const parsed = DateTime.fromISO(value);
		return parsed.isValid ? parsed.toMillis() : undefined;
	},
};
