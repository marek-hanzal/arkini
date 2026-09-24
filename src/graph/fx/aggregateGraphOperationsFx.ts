import { Clock, Effect } from "effect";
import { match } from "ts-pattern";
import type { GraphOperationsQuerySchema } from "~/graph/schema/GraphOperationsQuerySchema";
import type {
	GraphDiscoveryOperation,
	GraphOperationAggregation,
} from "~/graph/type/GraphDiscoveryResult";
import type { GraphResult } from "~/graph/type/GraphResult";

const groupKeyFn = (
	operation: GraphDiscoveryOperation,
	by: Extract<
		GraphOperationAggregation,
		{
			mode: "group";
		}
	>["by"],
): string | null =>
	match(by)
		.with("kind", () => operation.kind)
		.with("owner", () => operation.owner)
		.with("lineTitle", () => (operation.kind === "line" ? operation.title : null))
		.with("action", "effect", "ownership", (key) =>
			operation.kind === "merge" ? operation[key] : null,
		)
		.exhaustive();

/** Aggregate the entire filtered scope before slicing groups; scan bounds never masquerade as totals. */
export const aggregateGraphOperationsFx = Effect.fn("aggregateGraphOperationsFx")(function* (
	summaries: readonly GraphDiscoveryOperation[],
	candidates: readonly number[],
	ownerTitles: ReadonlyMap<string, string>,
	query: GraphOperationsQuerySchema.Type & {
		readonly aggregate: NonNullable<GraphOperationsQuerySchema.Type["aggregate"]>;
	},
	offset: number,
): Effect.fn.Return<{
	readonly aggregation: GraphOperationAggregation;
	readonly reasons: GraphResult["reasons"];
	readonly nextOffset?: number;
}> {
	const started = yield* Clock.currentTimeMillis;
	const reasons: GraphResult["reasons"][number][] = [];
	const groups = new Map<
		string | null,
		{
			key: string | null;
			label: string;
			count: number;
		}
	>();
	let count = 0;
	for (const index of candidates) {
		if (count >= query.maxExpansions) {
			reasons.push("expansions");
			break;
		}
		if (count % 64 === 0) {
			yield* Effect.yieldNow;
			if ((yield* Clock.currentTimeMillis) - started >= query.timeoutMs) {
				reasons.push("timeout");
				break;
			}
		}
		count++;
		if (query.aggregate.mode === "group") {
			const key = groupKeyFn(summaries[index], query.aggregate.by);
			const label = match(key)
				.with(null, () => "Not applicable")
				.otherwise((id) =>
					query.aggregate.mode === "group" && query.aggregate.by === "owner"
						? (ownerTitles.get(id) ?? id)
						: id,
				);
			const group = groups.get(key) ?? {
				key,
				label,
				count: 0,
			};
			group.count++;
			groups.set(key, group);
		}
	}
	const complete = count === candidates.length;
	if (query.aggregate.mode === "count")
		return {
			aggregation: {
				mode: "count",
				count,
				complete,
			},
			reasons,
		};
	const ordered = [
		...groups.values(),
	].sort((a, b) => b.count - a.count || (a.key ?? "").localeCompare(b.key ?? ""));
	// A partial scan cannot provide stable ranked pages. Retry with a larger scan budget instead.
	const start = complete ? offset : 0;
	const page = ordered.slice(start, start + query.limit);
	const hasMore = start + page.length < ordered.length;
	if (hasMore) reasons.push("limit");
	return {
		aggregation: {
			mode: "group",
			by: query.aggregate.by,
			count,
			complete,
			groups: page,
		},
		reasons,
		...(complete && hasMore
			? {
					nextOffset: start + page.length,
				}
			: {}),
	};
});
