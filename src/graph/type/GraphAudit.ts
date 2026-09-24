/** Snapshot-native indexes distinguish authored participation from mere references. */
export interface GraphAuditItem {
	readonly nodeId: string;
	readonly connected: boolean;
	readonly ownsOperation: boolean;
	readonly source: boolean;
	readonly producers: readonly string[];
	readonly consumers: readonly string[];
	readonly referenceOnly: boolean;
}

export interface GraphAuditIndex {
	readonly items: readonly GraphAuditItem[];
}

export interface GraphAuditMatch {
	readonly nodeId: string;
	readonly reason: string;
	readonly relatedNodeIds: readonly string[];
}

export interface GraphAuditResult {
	readonly matches: readonly GraphAuditMatch[];
	/** Number of confirmed matches; only a complete analysis makes this a total. */
	readonly count: number;
	readonly complete: boolean;
}
