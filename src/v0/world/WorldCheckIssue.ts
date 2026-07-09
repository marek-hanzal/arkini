import type { WorldEntityRef } from "~/world/WorldEntityRef";

type WorldCheckIssueSeverity = "error" | "warning" | "info";

type WorldCheckIssueCode =
	| "active_effect_apply_state_invalid"
	| "active_effect_delivery_job_linked"
	| "craft_and_producer_share_target"
	| "craft_delivery_before_ready"
	| "delivery_job_paused"
	| "producer_delivery_before_ready"
	| "producer_job_starts_before_queue_barrier"
	| "producer_queue_delivery_not_head";

export interface WorldCheckIssue {
	code: WorldCheckIssueCode;
	evidence?: Record<string, unknown>;
	message: string;
	entity: WorldEntityRef;
	severity: WorldCheckIssueSeverity;
}
