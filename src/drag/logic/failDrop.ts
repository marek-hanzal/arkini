import type { DropContext } from "~/drag/DropContext";
import type { DropOutcome } from "~/drag/DropOutcome";
import type { DropPlanRuntime } from "~/drag/DropPlanRuntime";
import type { RectLike } from "~/play/types";
import { animateReturn } from "./animateReturn";
import { runFeedback } from "./runFeedback";

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
}: failDrop.Props<ItemId, Source, Target, Overlay, Kind>): Promise<DropOutcome> => {
	runtime.clearHiddenSources();
	const feedback = runFeedback(() => runtime.onError?.(error, context));
	await animateReturn({
		source: context.source,
		dragRect,
		hideSources: runtime.hideSources,
		clearActiveDrag: runtime.clearActiveDrag,
		clearHiddenSources: runtime.clearHiddenSources,
		animate: runtime.animate,
	});
	await feedback;
	return "reject";
};
