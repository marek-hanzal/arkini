import type { DropContext } from "~/drag/DropContext";
import type { DropOutcome } from "~/drag/DropOutcome";
import type { DropPlan } from "~/drag/DropPlan";
import type { DropPlanRuntime } from "~/drag/DropPlanRuntime";
import type { RectLike } from "~/play/types";
import { runAcceptPlan } from "./runAcceptPlan";
import { runIgnorePlan } from "./runIgnorePlan";
import { runRejectPlan } from "./runRejectPlan";

export namespace runDropPlan {
	export interface Props<ItemId extends string, Source, Target, Overlay, Kind extends string> {
		context: DropContext<ItemId, Source, Target, Overlay>;
		plan: DropPlan<ItemId, Kind, Overlay>;
		dragRect: RectLike | null;
		runtime: DropPlanRuntime<ItemId, Source, Target, Overlay, Kind>;
	}
}

export const runDropPlan = async <
	ItemId extends string = string,
	Source = unknown,
	Target = unknown,
	Overlay = unknown,
	Kind extends string = string,
>({
	context,
	plan,
	dragRect,
	runtime,
}: runDropPlan.Props<ItemId, Source, Target, Overlay, Kind>): Promise<DropOutcome> => {
	if (plan.type === "ignore")
		return runIgnorePlan({
			runtime,
		});
	if (plan.type === "reject")
		return runRejectPlan({
			context,
			plan,
			dragRect,
			runtime,
		});
	return runAcceptPlan({
		context,
		plan,
		dragRect,
		runtime,
	});
};
