import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { TimeSchema } from "~/engine/common/schema/TimeSchema";
import type { InputRunResolutionSchema } from "~/engine/input/schema/run/InputRunResolutionSchema";
import type { LineRunPlanResolutionSchema } from "~/engine/line/schema/run/LineRunPlanResolutionSchema";
import type { LineRunPlanSchema } from "~/engine/line/schema/run/LineRunPlanSchema";

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

	const inputPlans: LineRunPlanSchema.Type["input"][number][] = [];
	for (const { plan } of input) {
		if (plan === undefined) {
			return undefined;
		}
		inputPlans.push(plan);
	}
	const [firstInputPlan, ...remainingInputPlans] = inputPlans;
	if (firstInputPlan === undefined) {
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
