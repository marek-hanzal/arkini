import type { DropContext } from "~/drag/DropContext";
import type { DropPlanRuntime } from "~/drag/DropPlanRuntime";
import type { RectLike } from "~/play/types";
import { animateReturn } from "./animateReturn";
import { runFeedback } from "./runFeedback";
import { settleWorkflow } from "./settleWorkflow";

export namespace failDrop {
	export interface Props<ItemId extends string, Source, Target, Overlay, Kind extends string> {
		error: unknown;
		context: DropContext<ItemId, Source, Target, Overlay>;
		dragRect: RectLike | null;
		runtime: DropPlanRuntime<ItemId, Source, Target, Overlay, Kind>;
	}
}

export const failDrop = async <
	ItemId extends string = string,
	Source = unknown,
	Target = unknown,
	Overlay = unknown,
	Kind extends string = string,
>({
	error,
	context,
	dragRect,
	runtime,
}: failDrop.Props<ItemId, Source, Target, Overlay, Kind>) => {
	runtime.sendWorkflow({
		type: "DROP_FAILED",
	});
	runtime.clearHiddenSources();
	const feedback = runFeedback(() => runtime.onError?.(error, context));
	await animateReturn({
		source: context.source,
		dragRect,
		send: runtime.sendWorkflow,
		hideSources: runtime.hideSources,
		clearActiveDrag: runtime.clearActiveDrag,
		clearHiddenSources: runtime.clearHiddenSources,
		animate: runtime.animate,
	});
	runtime.sendWorkflow({
		type: "FEEDBACK_STARTED",
	});
	await feedback;
	settleWorkflow({
		send: runtime.sendWorkflow,
	});
};
