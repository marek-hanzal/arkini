import { Effect } from "effect";
import { readItemScheduleFn } from "~/item-schedule/fn/readItemScheduleFn";
import { resolveActionEnableFn } from "~/production-action/fn/resolveActionEnableFn";
import { resolveActionRuleFx } from "~/production-action/fx/resolveActionRuleFx";
import { readItemScheduleContextFx } from "~/item-schedule/fx/readItemScheduleContextFx";
import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

/** Evaluates timer availability independently of the owner's admitted production. */
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
	const context = yield* readItemScheduleContextFx({
		item,
		runtime,
	}).pipe(Effect.catchTag("ItemNotOnBoardError", () => Effect.succeed(undefined)));
	if (context === undefined) return false;
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
