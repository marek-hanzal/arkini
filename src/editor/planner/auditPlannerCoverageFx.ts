import { Effect } from "effect";

import { auditPlannerCoverageWithPlannerFx } from "~/editor/planner/auditPlannerCoverageWithPlannerFx";
import { createBestFirstPlannerStrategyFx } from "~/editor/planner/createBestFirstPlannerStrategyFx";
import { createPlannerFx } from "~/editor/planner/createPlannerFx";

export namespace auditPlannerCoverageFx {
	export type Props = Omit<auditPlannerCoverageWithPlannerFx.Props, "planner">;
}

/** Audits bounded engine-planner coverage over one immutable game configuration. */
export const auditPlannerCoverageFx = Effect.fn("auditPlannerCoverageFx")(
	(props: auditPlannerCoverageFx.Props) =>
		Effect.gen(function* () {
			const strategy = yield* createBestFirstPlannerStrategyFx({
				budget: props.budget,
			});
			const planner = yield* createPlannerFx({
				config: props.config,
				strategy,
			});
			return yield* auditPlannerCoverageWithPlannerFx({
				...props,
				planner,
			});
		}),
);
