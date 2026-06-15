import type { DropContext } from "~/drag/DropContext";
import type { DropPlan } from "~/drag/DropPlan";
import type { DropOutcome } from "~/drag/DropOutcome";
import type { DropPlanRuntime } from "~/drag/DropPlanRuntime";
import type { RectLike } from "~/play/types";
import { waitForPaint } from "~/shared/util/waitForPaint";

export namespace runAcceptPlan {
	export interface Props<ItemId extends string, Source, Target, Overlay, Kind extends string> {
		context: DropContext<ItemId, Source, Target, Overlay>;
		plan: Extract<
			DropPlan<ItemId, Kind, Overlay>,
			{
				type: "accept";
			}
		>;
		dragRect: RectLike | null;
		runtime: DropPlanRuntime<ItemId, Source, Target, Overlay, Kind>;
	}
}

export const runAcceptPlan = async <
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
}: runAcceptPlan.Props<ItemId, Source, Target, Overlay, Kind>): Promise<DropOutcome> => {
	runtime.hideSources(plan.hide ?? []);

	await plan.commit({
		dragRect,
		dragActorKey: context.source.actorKey,
	});

	runtime.clearActiveDrag();
	runtime.clearHiddenSources();
	await waitForPaint();
	await plan.feedback?.();
	return "accept";
};
