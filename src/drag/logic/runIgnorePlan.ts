import type { DropOutcome } from "~/drag/DropOutcome";
import type { DropPlanRuntime } from "~/drag/DropPlanRuntime";
import { settleWorkflow } from "./settleWorkflow";

export namespace runIgnorePlan {
	export interface Props<ItemId extends string, Source, Target, Overlay, Kind extends string> {
		runtime: DropPlanRuntime<ItemId, Source, Target, Overlay, Kind>;
	}
}

export const runIgnorePlan = <
	ItemId extends string = string,
	Source = unknown,
	Target = unknown,
	Overlay = unknown,
	Kind extends string = string,
>({
	runtime,
}: runIgnorePlan.Props<ItemId, Source, Target, Overlay, Kind>): DropOutcome => {
	runtime.sendWorkflow({
		type: "DROP_IGNORED",
	});
	runtime.clearActiveDrag();
	settleWorkflow({
		send: runtime.sendWorkflow,
	});
	return "ignore";
};
