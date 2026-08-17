import { Effect } from "effect";

import { auditPlannerCoverageWithPlannerFx } from "~/editor/planner/auditPlannerCoverageWithPlannerFx";
import { createBestFirstPlannerStrategyFx } from "~/editor/planner/createBestFirstPlannerStrategyFx";
import { createPlannerFx } from "~/editor/planner/createPlannerFx";
import type { PlannerCoverageAuditReport } from "~/editor/planner/PlannerCoverageAudit";
import type { PlannerCoverageAuditRequest } from "~/editor/planner/PlannerCoverageAuditRequest";

export namespace auditPlannerCoverageFx {
	export interface Props extends PlannerCoverageAuditRequest {}
}

/** Audits bounded engine-planner coverage over one immutable game configuration. */
export const auditPlannerCoverageFx: (
	props: auditPlannerCoverageFx.Props,
) => Effect.Effect<PlannerCoverageAuditReport, unknown> = Effect.fn("auditPlannerCoverageFx")(
	(props: auditPlannerCoverageFx.Props) =>
		Effect.gen(function* (): Effect.fn.Return<PlannerCoverageAuditReport, unknown> {
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
