import { readGraphSpaceDestinationIdFn } from "~/graph/fn/readGraphSpaceDestinationIdFn";
import { match } from "ts-pattern";
import type { GraphOperation } from "~/graph/type/GraphFacts";
import type { GraphDiscoveryOperation } from "~/graph/type/GraphDiscoveryResult";

/** Bounded operation semantics shared by discovery and snapshot filter indexes. */
export const readGraphOperationSummaryFn = (
	operation: GraphOperation,
	ownerTitle: string,
): GraphDiscoveryOperation => {
	const outcomes = operation.kind === "clock" ? undefined : operation.data.outcome;
	const base = {
		id: operation.id,
		owner: operation.owner,
		hasOutcomes:
			outcomes?.set.some((set) => set.roll.some((roll) => roll.outcome.length > 0)) ?? false,
	};
	return match(operation)
		.returnType<GraphDiscoveryOperation>()
		.with(
			{
				kind: "line",
			},
			({ data }) => ({
				...base,
				kind: "line",
				title: data.title,
				lineUid: data.uid,
				runtimeSeconds: data.runtimeMs / 1000,
				default: data.default,
				clock: data.clock !== undefined,
				clockWeight: data.clockWeight,
				show: data.show,
				enable: data.enable,
			}),
		)
		.with(
			{
				kind: "merge",
			},
			({ data }) => ({
				...base,
				kind: "merge",
				title: `${ownerTitle} · Merge`,
				action: data.action,
				effect: data.effect,
				ownership: data.action === "space" ? "receiver" : "source",
				...(data.action === "space"
					? {
							destination: readGraphSpaceDestinationIdFn(data.space),
						}
					: {
							target: `item:${data.target.itemUid}`,
						}),
				...(data.effect === "replace"
					? {
							replacement: `item:${data.result}`,
						}
					: {}),
			}),
		)
		.with(
			{
				kind: "clock",
			},
			({ data }) => ({
				...base,
				kind: "clock",
				title: `${ownerTitle} · Clock`,
				enable: data.enable,
				...(data.intervalMs === undefined
					? {}
					: {
							intervalSeconds: data.intervalMs / 1000,
						}),
				...(data.durationMs === undefined
					? {}
					: {
							durationSeconds: data.durationMs / 1000,
						}),
				...(data.expiryMode === undefined
					? {}
					: {
							expiryMode: data.expiryMode,
						}),
			}),
		)
		.with(
			{
				kind: "depletion",
			},
			({ data }) => ({
				...base,
				kind: "depletion",
				title: `${ownerTitle} · Depletion`,
				amount: data.amount,
			}),
		)
		.exhaustive();
};
