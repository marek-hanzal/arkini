/** Counts are complete; identities are bounded samples for exact follow-up queries. */
export type GraphAuditFact =
	| {
			readonly kind: "producer" | "usage" | "behavior" | "configuration-only" | "reference";
			readonly count: number;
			readonly operationIds: readonly string[];
	  }
	| {
			readonly kind: "template";
			readonly count: number;
			readonly nodeIds: readonly string[];
	  };

export interface GraphAuditItem {
	readonly nodeId: string;
	readonly connected: boolean;
	readonly referenceOnly: boolean;
	readonly facts: readonly GraphAuditFact[];
}

export interface GraphAuditIndex {
	readonly items: readonly GraphAuditItem[];
}

export interface GraphAuditMatch {
	readonly nodeId: string;
	readonly reason: string;
	readonly facts: readonly GraphAuditFact[];
}

export interface GraphAuditResult {
	readonly matches: readonly GraphAuditMatch[];
	/** Number of confirmed matches; only a complete analysis makes this a total. */
	readonly count: number;
	readonly complete: boolean;
}
