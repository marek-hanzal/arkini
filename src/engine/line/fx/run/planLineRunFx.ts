import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { TimeSchema } from "~/engine/common/schema/TimeSchema";
import type { InputRun } from "~/engine/input/InputRun";
import type { LineRun } from "~/engine/line/LineRun";

export namespace planLineRunFx {
	export interface Props {
		enable: boolean;
		input: readonly [
			InputRun.Resolution,
			...InputRun.Resolution[],
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

	const inputPlans: InputRun.Plan[] = [];
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
	] satisfies LineRun.Plan["input"];

	return {
		ownerItemId,
		lineId,
		runtimeMs,
		input: plannedInputs,
	} satisfies LineRun.Plan;
});
