import type { DropContext } from "~/drag/DropContext";
import type { DropPlan } from "~/drag/DropPlan";
import type { DropPlanRuntime } from "~/drag/DropPlanRuntime";
import type { RectLike } from "~/play/types";
import { waitForPaint } from "~/shared/util/waitForPaint";
import { settleWorkflow } from "./settleWorkflow";

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
	plan,
	runtime,
}: runAcceptPlan.Props<ItemId, Source, Target, Overlay, Kind>) => {
	runtime.sendWorkflow({
		type: "DROP_ACCEPTED",
	});
	runtime.hideSources(plan.hide ?? []);
	runtime.sendWorkflow({
		type: "COMMIT_STARTED",
	});

	await plan.commit();

	runtime.clearActiveDrag();
	runtime.clearHiddenSources();
	await waitForPaint();
	runtime.sendWorkflow({
		type: "FEEDBACK_STARTED",
	});
	await plan.feedback?.();
	settleWorkflow({
		send: runtime.sendWorkflow,
	});
};
