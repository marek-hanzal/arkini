import { Order } from "effect";

import { readAcquisitionAvailabilityRequirementsFn } from "~/flow/fn/readAcquisitionAvailabilityRequirementsFn";
import type { ItemConnectionFilter } from "~/flow/type/ItemConnectionFilter";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { InputSchema as LineInputSchema } from "~/production-input/schema/InputSchema";
import type { InputSchema as ActionInputSchema } from "~/production-action/schema/InputSchema";
import type { WhenSchema } from "~/production-condition/schema/WhenSchema";
import type { RollSchema } from "~/outcome/schema/RollSchema";
import type { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";

interface ItemConnectionFact {
	readonly factId: string;
	readonly origin: readItemConnectionFactsFn.Origin;
}

const readInputItemUidFn = (input: LineInputSchema.Type | ActionInputSchema.Type) => {
	switch (input.type) {
		case "simple":
			return undefined;
		case "materials":
			return input.query.selector.itemUid;
		case "units":
			return input.query.selector.itemUid;
	}
};

const readAvailabilityFactsFn = (
	rules: ReadonlyArray<{
		readonly type: string;
		readonly when: ReadonlyArray<WhenSchema.Type>;
	}>,
) =>
	rules.flatMap((rule, ruleIndex) => {
		const requirements = readAcquisitionAvailabilityRequirementsFn({
			rules: [
				rule,
			],
			source: "line-condition",
		});
		// A disable rule with a fact-free escape has no positive dependency, even if another condition does.
		if (requirements.allOf.length === 0 && requirements.anyOf.length === 0) return [];
		return rule.when.flatMap((when, whenIndex) => {
			const condition = readAcquisitionAvailabilityRequirementsFn({
				rules: [
					{
						...rule,
						when: [
							when,
						],
					},
				],
				source: "line-condition",
			});
			return [
				...condition.allOf,
				...condition.anyOf.flat(),
			].map(({ factId }) => ({
				factId,
				condition: {
					ruleIndex,
					whenIndex,
				},
			}));
		});
	});

const addOutputFactsFn = (
	facts: ItemConnectionFact[],
	output: OutcomeTableSchema.Type | undefined,
	source: readItemConnectionFactsFn.Source,
) => {
	if (output === undefined) return;
	for (const [setIndex, set] of output.set.entries()) {
		for (const { factId, condition } of readAvailabilityFactsFn(set.rules))
			facts.push({
				factId,
				origin: {
					source,
					role: "condition",
					condition,
					setIndex,
				},
			});
		for (const [rollIndex, roll] of set.roll.entries()) {
			for (const [outcomeIndex, drop] of roll.outcome.entries()) {
				const position = {
					setIndex,
					rollIndex,
					rollType: roll.type,
					outcomeIndex,
				};
				if (drop.type === "item")
					facts.push({
						factId: drop.itemUid,
						origin: {
							source,
							role: "output",
							roll: position,
						},
					});
				for (const { factId, condition } of readAvailabilityFactsFn(drop.rules))
					facts.push({
						factId,
						origin: {
							source,
							role: "condition",
							condition,
							roll: position,
						},
					});
			}
		}
	}
};

const readOwnerFactsFn = (item: ItemSchema.Type): ItemConnectionFact[] => {
	const facts: ItemConnectionFact[] = [];
	for (const [lineIndex, line] of item.lines.entries()) {
		const source: readItemConnectionFactsFn.Source = {
			type: "line",
			lineIndex,
			title: line.title,
		};
		for (const [inputIndex, input] of line.input.entries()) {
			const factId = readInputItemUidFn(input);
			if (factId !== undefined)
				facts.push({
					factId,
					origin: {
						source,
						role: "input",
						inputIndex,
					},
				});
		}
		for (const { factId, condition } of readAvailabilityFactsFn(line.rules))
			facts.push({
				factId,
				origin: {
					source,
					role: "condition",
					condition,
				},
			});
		addOutputFactsFn(facts, line.outcome, source);
	}
	for (const [mergeIndex, merge] of (item.merge ?? []).entries()) {
		const source = {
			type: "merge",
			mergeIndex,
		} as const;
		if (merge.action !== "space")
			facts.push({
				factId: merge.target.itemUid,
				origin: {
					source,
					role: "input",
				},
			});
		if (merge.effect === "replace")
			facts.push({
				factId: merge.result,
				origin: {
					source,
					role: "replacement",
				},
			});
		addOutputFactsFn(facts, merge.outcome, source);
	}
	addOutputFactsFn(facts, item.units?.outcome, {
		type: "units",
	});
	if (item.clock !== undefined) {
		addOutputFactsFn(facts, item.clock.onExpire, {
			type: "expiry",
		});
		for (const { factId, condition } of readAvailabilityFactsFn(item.clock.rules))
			facts.push({
				factId,
				origin: {
					source: {
						type: "clock",
					},
					role: "condition",
					condition,
				},
			});
	}
	return facts;
};

/** Preserves the authored reason for each connection, in either direction, without runtime filtering. */
export const readItemConnectionFactsFn = (
	config: GameConfigSchema.Type,
	factId: string,
	filter: ItemConnectionFilter,
): readItemConnectionFactsFn.Connection[] => {
	const reverse = filter === "required-by" || filter === "produced-by";
	const outputs = filter === "produces" || filter === "produced-by";
	const connections = new Map<string, Map<string, readItemConnectionFactsFn.Origin>>();
	const owners = reverse
		? Object.values(config.items)
		: [
				config.items[factId],
			];
	for (const owner of owners) {
		if (owner === undefined) continue;
		for (const fact of readOwnerFactsFn(owner)) {
			const isOutput = fact.origin.role === "output" || fact.origin.role === "replacement";
			if (isOutput !== outputs || (reverse && fact.factId !== factId)) continue;
			const itemUid = reverse ? owner.uid : fact.factId;
			if (itemUid === factId) continue;
			let origins = connections.get(itemUid);
			if (origins === undefined) {
				origins = new Map();
				connections.set(itemUid, origins);
			}
			origins.set(JSON.stringify(fact.origin), fact.origin);
		}
	}
	return [
		...connections,
	]
		.sort(([left], [right]) => Order.String(left, right))
		.map(([itemUid, origins]) => ({
			itemUid,
			origins: [
				...origins.values(),
			],
		}));
};

export namespace readItemConnectionFactsFn {
	export type Source =
		| {
				readonly type: "line";
				readonly lineIndex: number;
				readonly title: string;
		  }
		| {
				readonly type: "merge";
				readonly mergeIndex: number;
		  }
		| {
				readonly type: "units" | "expiry" | "clock";
		  };

	export interface Origin {
		readonly source: Source;
		readonly role: "input" | "condition" | "output" | "replacement";
		readonly inputIndex?: number;
		readonly setIndex?: number;
		readonly condition?: {
			readonly ruleIndex: number;
			readonly whenIndex: number;
		};
		readonly roll?: {
			readonly setIndex: number;
			readonly rollIndex: number;
			readonly outcomeIndex?: number;
			readonly rollType: RollSchema.Type["type"];
		};
	}

	export interface Connection {
		readonly itemUid: string;
		readonly origins: readonly Origin[];
	}
}
