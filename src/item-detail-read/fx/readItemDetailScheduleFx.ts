import { Effect } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { resolveItemScheduleEnabledFx } from "~/item-schedule/fx/resolveItemScheduleEnabledFx";

export namespace readItemDetailScheduleFx {
	export interface Schedule {
		readonly intervalMs: number;
		readonly durationMs?: number;
		readonly control: "automatic-only" | "interactive";
		readonly runtime?: {
			readonly running: boolean;
			readonly remainingIntervalMs: number;
			readonly remainingDurationMs?: number;
			readonly status: "running" | "paused" | "draining";
		};
	}
}

/** Projects scheduled production through the same rule gate used by Tick. */
export const readItemDetailScheduleFx = Effect.fn("readItemDetailScheduleFx")(function* ({
	itemId,
	runtime,
}: {
	readonly itemId: IdSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) {
	const owner = runtime.items.find((item) => item.id === itemId);
	if (owner === undefined || !("intervalMs" in owner.item)) return undefined;
	const enabled = yield* resolveItemScheduleEnabledFx({
		item: owner,
		runtime,
	});
	const remainingDurationMs = owner.schedule?.remainingDurationMs ?? owner.item.durationMs;
	return {
		intervalMs: owner.item.intervalMs,
		durationMs: owner.item.durationMs,
		control: owner.item.control,
		runtime: {
			running: owner.schedule?.running ?? true,
			remainingIntervalMs: owner.schedule?.remainingIntervalMs ?? owner.item.intervalMs,
			remainingDurationMs,
			status: remainingDurationMs === 0 ? "draining" : enabled ? "running" : "paused",
		},
	} satisfies readItemDetailScheduleFx.Schedule;
});
