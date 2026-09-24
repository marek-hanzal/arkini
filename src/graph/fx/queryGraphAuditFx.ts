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
	const countFn = (kind: GraphAuditItem["facts"][number]["kind"]) =>
		item.facts.find((fact) => fact.kind === kind)?.count ?? 0;
	const reason = match(audit)
		.with("dangling", () =>
			!item.connected && countFn("behavior") === 0
				? "No authored relationship or configured input, output, unit cost or merge interaction."
				: undefined,
		)
		.with("no-producer", () =>
			countFn("producer") === 0
				? "No authored operation outputs this item; template placement is listed separately."
				: undefined,
		)
		.with("no-usage", () =>
			countFn("usage") === 0
				? "No authored input, unit payer or merge source/target participation."
				: undefined,
		)
		.with("no-behavior", () =>
			countFn("behavior") === 0
				? "No owned operation has configured inputs, outputs, unit costs or a merge interaction."
				: undefined,
		)
		.with("source-only", () =>
			countFn("template") > 0 && countFn("producer") === 0
				? "Placed in an authored template, with no authored producer."
				: undefined,
		)
		.with("reference-only", () =>
			item.referenceOnly
				? "Connected only by rule references, without other authored relationships or configured behavior."
				: undefined,
		)
		.exhaustive();
	if (reason === undefined) return undefined;
	return {
		nodeId: item.nodeId,
		reason,
		facts: item.facts,
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
