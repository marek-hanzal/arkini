import type { WorldEntityRef } from "~/v0/game/world/WorldEntityRef";

type WorldCheckIssueSeverity = "error" | "warning" | "info";

type WorldCheckIssueCode =
	| "active_effect_apply_state_invalid"
	| "craft_and_producer_share_target"
	| "delivery_job_paused"
	| "producer_job_starts_before_queue_barrier"
	| "producer_queue_delivery_not_head";

export interface WorldCheckIssue {
	code: WorldCheckIssueCode;
	evidence?: Record<string, unknown>;
	message: string;
	entity: WorldEntityRef;
	severity: WorldCheckIssueSeverity;
}
