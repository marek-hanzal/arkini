import type { DropContext } from "~/drag/DropContext";
import type { DropPlan } from "~/drag/DropPlan";
import type { DropOutcome } from "~/drag/DropOutcome";
import type { DropPlanRuntime } from "~/drag/DropPlanRuntime";
import type { RectLike } from "~/play/types";
import { animateReturn } from "./animateReturn";
import { runFeedback } from "./runFeedback";

export namespace runRejectPlan {
	export interface Props<ItemId extends string, Source, Target, Overlay, Kind extends string> {
		context: DropContext<ItemId, Source, Target, Overlay>;
		plan: Extract<
			DropPlan<ItemId, Kind, Overlay>,
			{
				type: "reject";
			}
		>;
		dragRect: RectLike | null;
		runtime: DropPlanRuntime<ItemId, Source, Target, Overlay, Kind>;
	}
}

export const runRejectPlan = async <
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
}: runRejectPlan.Props<ItemId, Source, Target, Overlay, Kind>): Promise<DropOutcome> => {
	const feedback = runFeedback(plan.feedback);
	if (plan.animateReturn !== false)
		await animateReturn({
			source: context.source,
			dragRect,
			hideSources: runtime.hideSources,
			clearActiveDrag: runtime.clearActiveDrag,
			clearHiddenSources: runtime.clearHiddenSources,
			animate: runtime.animate,
		});
	else runtime.clearActiveDrag();
	await feedback;
	return "reject";
};
