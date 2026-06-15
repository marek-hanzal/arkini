import { Context } from "effect";
import type { DateTime } from "luxon";

export interface DateService {
	now(): DateTime;
	nowMs(): number;
	timestamp(): string;
	toTimestamp(date: DateTime): string;
	parseTimestampMs(value: string): number | undefined;
}

export class DateServiceFx extends Context.Tag("DateServiceFx")<DateServiceFx, DateService>() {
	//
}
