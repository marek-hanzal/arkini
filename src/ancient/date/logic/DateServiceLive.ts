import { DateTime } from "luxon";
import type { DateService } from "~/date/context/DateServiceFx";
import { toTimestamp } from "~/date/logic/toTimestamp";

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
