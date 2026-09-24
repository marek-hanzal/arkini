import { Clock, Effect } from "effect";
import { match } from "ts-pattern";
import type { GraphAuditQuerySchema } from "~/graph/schema/GraphAuditQuerySchema";
import type {
	GraphAuditIndex,
	GraphAuditItem,
	GraphAuditMatch,
	GraphAuditResult,
} from "~/graph/type/GraphAudit";
import type { GraphDiscoveryResult } from "~/graph/type/GraphDiscoveryResult";

const staticMatchFn = (
	item: GraphAuditItem,
	audit: GraphAuditQuerySchema.Type["audit"],
): GraphAuditMatch | undefined => {
	const reason = match(audit)
		.with("dangling", () =>
			!item.connected && !item.ownsOperation
				? "No authored relationship or owned gameplay operation."
				: undefined,
		)
		.with("no-producer", () =>
			item.producers.length === 0 && !item.source
				? "No possible authored producer and no start/template placement source."
				: undefined,
		)
		.with("no-consumer", () =>
			item.consumers.length === 0
				? "No owned operation, material/unit input or merge participation; rule references do not count as usage."
				: undefined,
		)
		.with("dead-end", () =>
			(item.producers.length > 0 || item.source) && item.consumers.length === 0
				? "Has an authored producer or template source, but no further gameplay usage."
				: undefined,
		)
		.with("source-only", () =>
			item.source && item.producers.length === 0
				? "Placed in an authored template, with no gameplay producer; source content, not automatically a defect."
				: undefined,
		)
		.with("reference-only", () =>
			item.referenceOnly
				? "Connected only by rule references, with no gameplay participation or placement."
				: undefined,
		)
		.with("no-owned-operation", () =>
			!item.ownsOperation
				? "Owns no line, merge, Clock or depletion operation; diagnostic, not automatically a defect."
				: undefined,
		)
		.exhaustive();
	if (reason === undefined) return undefined;
	return {
		nodeId: item.nodeId,
		reason,
		relatedNodeIds: item.producers.slice(0, 3),
	};
};

export namespace queryGraphAuditFx {
	export interface Result {
		readonly audit: GraphAuditResult;
		readonly expansions: number;
		readonly reasons: GraphDiscoveryResult["reasons"];
	}
}

/** One bounded snapshot analysis. The caller pages this frozen result, never a client adjacency scan. */
export const queryGraphAuditFx = Effect.fn("queryGraphAuditFx")(function* (
	index: GraphAuditIndex,
	query: GraphAuditQuerySchema.Type,
): Effect.fn.Return<queryGraphAuditFx.Result> {
	const started = yield* Clock.currentTimeMillis;
	const candidates = index.items;
	const reasons = new Set<GraphDiscoveryResult["reasons"][number]>();
	let expansions = 0;
	const matches: GraphAuditMatch[] = [];
	let complete = true;
	for (const item of candidates) {
		if (expansions >= query.maxExpansions) {
			reasons.add("expansions");
			complete = false;
			break;
		}
		if (expansions % 64 === 0) {
			yield* Effect.yieldNow;
			if ((yield* Clock.currentTimeMillis) - started >= query.timeoutMs) {
				reasons.add("timeout");
				complete = false;
				break;
			}
		}
		expansions++;
		const found = staticMatchFn(item, query.audit);
		if (found !== undefined) matches.push(found);
	}
	return {
		audit: {
			matches,
			count: matches.length,
			complete,
		},
		expansions,
		reasons: [
			...reasons,
		].sort(),
	};
});
