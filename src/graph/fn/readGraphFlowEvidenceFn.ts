import { readGraphSpaceDestinationIdFn } from "~/graph/fn/readGraphSpaceDestinationIdFn";
import { match, P } from "ts-pattern";
import type { GraphEdge, GraphNode, GraphOperation } from "~/graph/type/GraphFacts";
import type { GraphFlowStep } from "~/graph/type/GraphFlow";
import type { QuerySchema } from "~/item-query/schema/QuerySchema";
import type { QuantitySchema } from "~/item-definition/schema/QuantitySchema";
import type { RuleSchema } from "~/production-line/schema/RuleSchema";

const quantityFn = ({ min, max }: QuantitySchema.Type): string =>
	min === max ? `×${min}` : `×${min}–${max}`;
const textFn = (value: string): string => JSON.stringify(value).slice(1, -1);
const labelFn = (nodes: ReadonlyMap<string, GraphNode>, id: string): string => {
	const node = nodes.get(id);
	const identity = /^[\p{L}\p{N}_.:@/-]+$/u.test(id) ? id : JSON.stringify(id);
	return `${textFn(node?.title ?? id)} [${identity}]${node?.missing ? " (missing)" : ""}`;
};
const queryFn = (query: QuerySchema.Type, nodes: ReadonlyMap<string, GraphNode>): string =>
	`${labelFn(nodes, `item:${query.selector.itemUid}`)}; distance=${query.distance}`;
const rulesFn = (
	scope: string,
	rules: readonly RuleSchema.Type[],
	nodes: ReadonlyMap<string, GraphNode>,
): readonly string[] =>
	rules.map((rule, index) => {
		const action = match(rule)
			.with(
				{
					type: "runtime:adjust",
				},
				({ adjustMs }) => `runtime adjustment=${adjustMs / 1000}s`,
			)
			.with(
				{
					type: "runtime:multiplier",
				},
				({ multiplier }) => `runtime multiplier=${multiplier}`,
			)
			.with(
				{
					type: P.union("enable", "disable", "show", "hide"),
				},
				({ type }) => type,
			)
			.exhaustive();
		const conditions = rule.when.map((condition) => {
			const comparison = match(condition)
				.with(
					{
						type: "exists",
					},
					() => "quantity > 0",
				)
				.with(
					{
						type: "count",
					},
					({ count }) => `quantity = ${count}`,
				)
				.with(
					{
						type: "range",
					},
					({ min, max }) => `quantity in ${min}–${max} inclusive`,
				)
				.exhaustive();
			return `(${queryFn(condition.query, nodes)}; ${comparison})`;
		});
		return `${scope} rule ${index + 1}: ${action} when ALL ${conditions.join(" AND ")}${rule.hint === undefined ? "" : `; hint=${textFn(rule.hint)}`}`;
	});

/** Projects authored facts for one selected output occurrence, without evaluating availability. */
export const readGraphFlowEvidenceFn = (
	operation: GraphOperation,
	output: GraphEdge,
	fromRole: GraphFlowStep["evidence"]["fromRole"],
	participants: readonly string[],
	nodes: ReadonlyMap<string, GraphNode>,
): GraphFlowStep["evidence"] => {
	const facts = match(operation)
		.returnType<string[]>()
		.with(
			{
				kind: "line",
			},
			({ data }) => [
				`Line ${textFn(data.title)}; uid=${data.uid}; runtimeSeconds=${data.runtimeMs / 1000}; enable=${data.enable}; show=${data.show}; default=${data.default}; trigger=${data.trigger}; weight=${data.weight}`,
				...data.input.map((input, index) => {
					const requirement = match(input)
						.with(
							{
								type: "materials",
							},
							(value) =>
								`${queryFn(value.query, nodes)}; ${quantityFn(value.quantity)}; mode=${value.mode}`,
						)
						.with(
							{
								type: "units",
							},
							(value) => `unit payer ${queryFn(value.query, nodes)}`,
						)
						.exhaustive();
					return `Input ${index + 1}: ${requirement}${input.units === undefined ? "" : `; units cost=${input.units.cost}; paid by=${input.units.from}`}`;
				}),
				...rulesFn("Operation", data.rules, nodes),
			],
		)
		.with(
			{
				kind: "merge",
			},
			({ data }) => [
				`Merge action=${data.action}; effect=${data.effect}; ownership=${data.action === "space" ? "receiver" : "source"}`,
				data.action === "space"
					? `Transport destination: ${labelFn(nodes, readGraphSpaceDestinationIdFn(data.space))}; incoming item identity is unspecified`
					: `Target: ${labelFn(nodes, `item:${data.target.itemUid}`)}`,
				...(data.effect === "replace"
					? [
							`Replacement: ${labelFn(nodes, `item:${data.result}`)}`,
						]
					: []),
				...(data.action === "spend"
					? [
							"Source unit cost=1",
						]
					: []),
				...(data.effect === "spend"
					? [
							`${data.action === "space" ? "Receiver" : "Target"} unit cost=1`,
						]
					: []),
			],
		)
		.with(
			{
				kind: "clock",
			},
			({ data }) => [
				`Clock timing; enable=${data.enable}; intervalSeconds=${data.intervalMs === undefined ? "none" : data.intervalMs / 1000}; durationSeconds=${data.durationMs === undefined ? "none" : data.durationMs / 1000}`,
				...rulesFn("Operation", data.rules, nodes),
			],
		)
		.with(
			{
				kind: "depletion",
			},
			({ data }) => [
				`Depletion at zero remaining units; initial units=${data.amount}`,
			],
		)
		.exhaustive();
	const table =
		operation.kind === "line" || operation.kind === "merge"
			? operation.data.outcome
			: undefined;
	const { setIndex, rollIndex, outcomeIndex, outcome } = output.annotations;
	const set = setIndex === undefined ? undefined : table?.set[setIndex];
	const roll = rollIndex === undefined ? undefined : set?.roll[rollIndex];
	if (set !== undefined && setIndex !== undefined) {
		facts.push(
			`Output set ${setIndex + 1}/${table?.set.length}; relative weight=${set.weight}; weighted selection of one rule-eligible set`,
		);
		facts.push(...rulesFn(`Output set ${setIndex + 1}`, set.rules, nodes));
	}
	if (roll !== undefined && rollIndex !== undefined) {
		facts.push(
			`Roll ${rollIndex + 1}/${set?.roll.length}: ${roll.type}${roll.type === "chance" ? `; chance=${roll.chance}` : ""}; outcome ${outcomeIndex === undefined ? "?" : outcomeIndex + 1}/${roll.outcome.length}; every roll in the selected set is evaluated; outcomes share this roll and keep their own rules`,
		);
	}
	if (outcome !== undefined) {
		facts.push(
			match(outcome)
				.with(
					{
						type: "item",
					},
					(value) =>
						`Output: ${labelFn(nodes, output.to)} ${quantityFn(value.quantity)}; placement=${value.placement}${value.quantity.min === value.quantity.max ? "" : "; quantity is randomly selected within the inclusive range"}`,
				)
				.with(
					{
						type: "space",
					},
					() => `Output: select space ${labelFn(nodes, output.to)}`,
				)
				.with(
					{
						type: "template",
					},
					() => `Output: apply template ${labelFn(nodes, output.to)}`,
				)
				.exhaustive(),
		);
		facts.push(...rulesFn("Selected outcome", outcome.rules, nodes));
	}
	return {
		fromRole,
		output: output.kind === "merge-replacement" ? "replacement" : "outcome",
		participants,
		facts,
	};
};
