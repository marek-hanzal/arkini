import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { TimeSchema } from "~/engine/common/schema/TimeSchema";
import type { InputRun } from "~/engine/input/InputRun";
import type { lineRuleFx } from "~/engine/line/fx/lineRuleFx";

/** Internal snapshot-derived readiness and exact mutation plan for one product line. */
export namespace LineRun {
	export interface Plan {
		readonly ownerItemId: IdSchema.Type;
		readonly lineId: IdSchema.Type;
		readonly runtimeMs: TimeSchema.Type;
		readonly input: readonly [
			InputRun.Plan,
			...InputRun.Plan[],
		];
	}

	export interface Resolution {
		readonly ownerItemId: IdSchema.Type;
		readonly lineId: IdSchema.Type;
		readonly show: boolean;
		readonly enable: boolean;
		readonly rules: ReadonlyArray<lineRuleFx.Result>;
		readonly runtimeMs: TimeSchema.Type;
		readonly input: readonly [
			InputRun.Resolution,
			...InputRun.Resolution[],
		];
		readonly ready: boolean;
		readonly plan?: Plan;
	}
}
