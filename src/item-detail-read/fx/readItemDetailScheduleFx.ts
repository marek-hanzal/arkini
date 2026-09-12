import { Effect } from "effect";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { resolveItemScheduleEnabledFx } from "~/item-schedule/fx/resolveItemScheduleEnabledFx";

export namespace readItemDetailScheduleFx {
	export interface Schedule {
		readonly intervalMs?: number;
		readonly durationMs?: number;
		readonly control: "automatic-only" | "interactive";
		readonly runtime?: {
			readonly remainingIntervalMs?: number;
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
	if (owner === undefined || owner.item.type !== "common" || owner.item.clock === undefined)
		return undefined;
	const clock = owner.item.clock;
	const enabled = yield* resolveItemScheduleEnabledFx({
		item: owner,
		runtime,
	});
	const remainingDurationMs = owner.schedule?.remainingDurationMs ?? clock.durationMs;
	return {
		intervalMs: clock.intervalMs,
		durationMs: clock.durationMs,
		control: owner.item.control ?? "interactive",
		runtime: {
			remainingIntervalMs: owner.schedule?.remainingIntervalMs ?? clock.intervalMs,
			remainingDurationMs,
			status: remainingDurationMs === 0 ? "draining" : enabled ? "running" : "paused",
		},
	} satisfies readItemDetailScheduleFx.Schedule;
});
