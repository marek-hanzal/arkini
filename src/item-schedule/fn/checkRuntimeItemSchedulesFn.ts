import { readItemScheduleFn } from "~/item-schedule/fn/readItemScheduleFn";
import type { ItemScheduleIssueSchema } from "~/item-schedule/schema/ItemScheduleIssueSchema";
import { RuntimeCheckIssueEnumSchema } from "~/game-runtime/schema/RuntimeCheckIssueEnumSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";

/** Validates phase/lifetime against the immutable schedule, including exhausted saved owners. */
export const checkRuntimeItemSchedulesFn = (
	runtime: RuntimeSchema.Type,
): ItemScheduleIssueSchema.Type[] => {
	const issues: ItemScheduleIssueSchema.Type[] = [];
	for (const item of runtime.items) {
		const config = readItemScheduleFn(item.item);
		const state = item.schedule;
		let reason: ItemScheduleIssueSchema.Type["reason"] | undefined;
		if (config === undefined) {
			if (state !== undefined) reason = "unexpected-state";
		} else if (state === undefined) reason = "missing-state";
		else if (
			item.location.scope === LocationScopeEnumSchema.enum.Inventory ||
			item.location.scope === LocationScopeEnumSchema.enum.Toolbar ||
			item.quantity !== 1
		)
			reason = "invalid-location";
		else if (
			config.intervalMs === undefined
				? state.remainingIntervalMs !== undefined
				: state.remainingIntervalMs === undefined ||
					!Number.isSafeInteger(state.remainingIntervalMs) ||
					state.remainingIntervalMs <= 0 ||
					state.remainingIntervalMs > config.intervalMs
		)
			reason = "invalid-phase";
		else if (
			config.durationMs === undefined
				? state.remainingDurationMs !== undefined
				: state.remainingDurationMs === undefined ||
					!Number.isSafeInteger(state.remainingDurationMs) ||
					state.remainingDurationMs < 0 ||
					state.remainingDurationMs > config.durationMs
		)
			reason = "invalid-lifetime";
		else if (
			state.lineId != null &&
			(item.item.type !== "common" ||
				!item.item.lines.some((line) => line.id === state.lineId))
		)
			reason = "invalid-line";
		if (reason !== undefined)
			issues.push({
				type: RuntimeCheckIssueEnumSchema.enum.ItemSchedule,
				itemId: item.id,
				reason,
			});
	}
	return issues;
};
