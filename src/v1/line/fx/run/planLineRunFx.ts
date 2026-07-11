import { Array, Effect, Option } from "effect";

import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { TimeSchema } from "~/v1/common/schema/TimeSchema";
import type { InputRunResolutionSchema } from "~/v1/input/schema/run/InputRunResolutionSchema";
import type { LineRunPlanResolutionSchema } from "~/v1/line/schema/run/LineRunPlanResolutionSchema";
import type { LineRunPlanSchema } from "~/v1/line/schema/run/LineRunPlanSchema";

export namespace planLineRunFx {
	export interface Props {
		enable: boolean;
		input: [
			InputRunResolutionSchema.Type,
			...InputRunResolutionSchema.Type[],
		];
		lineId: IdSchema.Type;
		ownerItemId: IdSchema.Type;
		runtimeMs: TimeSchema.Type;
	}
}

/**
 * Builds one exact line-run plan only when availability and every input permit it.
 */
export const planLineRunFx = Effect.fn("planLineRunFx")(function* ({
	enable,
	input,
	lineId,
	ownerItemId,
	runtimeMs,
}: planLineRunFx.Props) {
	if (!enable || input.some(({ resolution }) => !resolution.ready)) {
		return undefined;
	}

	const inputPlans = Array.filterMap(input, ({ plan }) => Option.fromNullable(plan));
	const [firstInputPlan, ...remainingInputPlans] = inputPlans;
	if (inputPlans.length !== input.length || firstInputPlan === undefined) {
		return undefined;
	}
	const plannedInputs = [
		firstInputPlan,
		...remainingInputPlans,
	] satisfies LineRunPlanSchema.Type["input"];

	return {
		ownerItemId,
		lineId,
		runtimeMs,
		input: plannedInputs,
	} satisfies LineRunPlanResolutionSchema.Type;
});
