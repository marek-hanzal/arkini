import { Effect } from "effect";
import { readItemScheduleFn } from "~/item-schedule/fn/readItemScheduleFn";
import { resolveActionEnableFn } from "~/production-action/fn/resolveActionEnableFn";
import { resolveActionRuleFx } from "~/production-action/fx/resolveActionRuleFx";
import { readItemPhysicalContextFx } from "~/item-location/fx/readItemPhysicalContextFx";
import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

/** Evaluates timer availability at the item's current physical origin. */
export const resolveItemScheduleEnabledFx = Effect.fn("resolveItemScheduleEnabledFx")(function* ({
	item,
	runtime,
}: {
	readonly item: RuntimeItemSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) {
	const schedule = readItemScheduleFn(item.item);
	if (item.schedule?.remainingDurationMs === 0 || schedule === undefined) return false;
	if (schedule.rules.length === 0) return schedule.enable;
	const context = yield* readItemPhysicalContextFx({
		item,
		runtime,
	});
	const { origin } = context;
	const rules = yield* Effect.forEach(schedule.rules, (rule) =>
		resolveActionRuleFx({
			origin,
			rule,
		}),
	).pipe(
		Effect.provideService(RuntimeFx, {
			read: Effect.succeed(runtime),
		}),
	);
	return resolveActionEnableFn({
		enable: schedule.enable,
		rules,
	});
});
