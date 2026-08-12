import type { PlannerAction } from "~/editor/planner/PlannerAction";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { GameEventSchema } from "~/engine/event/schema/GameEventSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export type PlannerActionAttemptStage =
	| "autofill"
	| "complete"
	| "enqueue"
	| "expire"
	| "merge"
	| "place-owner"
	| "settle-input"
	| "start";

export interface PlannerActionAttempt {
	readonly failureTag: string;
	readonly missingQuantity?: number;
	readonly relatedRuntimeItemId?: IdSchema.Type;
	readonly runtimeItemId?: IdSchema.Type;
	readonly stage: PlannerActionAttemptStage;
}

export type PlannerRuntimeItemRole = "merge-source" | "merge-target" | "owner" | "temporary";

export type PlannerActionBlocker =
	| {
			readonly attempt: ReadonlyArray<PlannerActionAttempt>;
			readonly code: "action-rejected";
	  }
	| {
			readonly code: "runtime-item-missing";
			readonly itemId: IdSchema.Type;
			readonly role: PlannerRuntimeItemRole;
	  };

export type PlannerActionUnsupportedReason =
	| {
			readonly code: "authored-transition-missing";
	  }
	| {
			readonly code: "timed-work-not-instant";
			readonly runtimeMs: number;
	  };

export type PlannerActionActor =
	| {
			readonly jobId: IdSchema.Type;
			readonly kind: "line";
			readonly ownerRuntimeItemId: IdSchema.Type;
	  }
	| {
			readonly kind: "merge";
			readonly sourceRuntimeItemId: IdSchema.Type;
			readonly targetRuntimeItemId: IdSchema.Type;
	  }
	| {
			readonly itemRuntimeId: IdSchema.Type;
			readonly kind: "temporary-expiry";
	  };

export type PlannerActionResult =
	| {
			readonly action: PlannerAction;
			readonly actor: PlannerActionActor;
			readonly elapsedMs: number;
			readonly events: readonly GameEventSchema.Type[];
			readonly outputWitnessResolved: boolean;
			readonly runtime: RuntimeSchema.Type;
			readonly type: "completed";
	  }
	| {
			readonly action: PlannerAction;
			readonly blocker: PlannerActionBlocker;
			readonly runtime: RuntimeSchema.Type;
			readonly type: "blocked";
	  }
	| {
			readonly action: PlannerAction;
			readonly reason: PlannerActionUnsupportedReason;
			readonly runtime: RuntimeSchema.Type;
			readonly type: "unsupported";
	  };
