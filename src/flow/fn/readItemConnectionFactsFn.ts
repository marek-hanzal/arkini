import { Order } from "effect";

import { readAcquisitionAvailabilityRequirementsFn } from "~/flow/fn/readAcquisitionAvailabilityRequirementsFn";
import type { ItemConnectionFilter } from "~/flow/type/ItemConnectionFilter";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { InputSchema as LineInputSchema } from "~/production-input/schema/InputSchema";
import type { InputSchema as ActionInputSchema } from "~/production-action/schema/InputSchema";
import type { WhenSchema } from "~/production-condition/schema/WhenSchema";
import type { RollSchema } from "~/production-output/schema/RollSchema";
import type { OutputSchema } from "~/production-output/schema/OutputSchema";

interface ItemConnectionFact {
	readonly factId: string;
	readonly origin: readItemConnectionFactsFn.Origin;
}

const readInputItemIdFn = (input: LineInputSchema.Type | ActionInputSchema.Type) => {
	switch (input.type) {
		case "simple":
			return undefined;
		case "materials":
			return input.selector.itemId;
		case "units":
			return input.query.selector.itemId;
	}
};

const readAvailabilityFactsFn = (
	items: GameConfigSchema.Type["items"],
	rules: ReadonlyArray<{
		readonly type: string;
		readonly when: ReadonlyArray<WhenSchema.Type>;
	}>,
) =>
	rules.flatMap((rule, ruleIndex) => {
		const requirements = readAcquisitionAvailabilityRequirementsFn({
			items,
			rules: [
				rule,
			],
			source: "line-condition",
		});
		// A disable rule with a fact-free escape has no positive dependency, even if another condition does.
		if (requirements.allOf.length === 0 && requirements.anyOf.length === 0) return [];
		return rule.when.flatMap((when, whenIndex) => {
			const condition = readAcquisitionAvailabilityRequirementsFn({
				items,
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
	items: GameConfigSchema.Type["items"],
	facts: ItemConnectionFact[],
	output: OutputSchema.Type | undefined,
	source: readItemConnectionFactsFn.Source,
) => {
	if (output === undefined) return;
	for (const [setIndex, set] of output.set.entries())
		for (const [rollIndex, roll] of set.roll.entries()) {
			if (roll.type === "weight") {
				for (const [candidateIndex, candidate] of roll.drop.entries()) {
					for (const { factId, condition } of readAvailabilityFactsFn(
						items,
						candidate.rules,
					))
						facts.push({
							factId,
							origin: {
								source,
								role: "condition",
								condition,
								roll: {
									setIndex,
									rollIndex,
									rollType: roll.type,
									candidateIndex,
								},
							},
						});
				}
			}
			const drops =
				roll.type === "weight"
					? roll.drop.flatMap((candidate, candidateIndex) =>
							candidate.drop.map((drop, dropIndex) => ({
								drop,
								dropIndex,
								candidateIndex,
							})),
						)
					: roll.drop.map((drop, dropIndex) => ({
							drop,
							dropIndex,
						}));
			for (const { drop, ...dropPosition } of drops) {
				const position = {
					setIndex,
					rollIndex,
					rollType: roll.type,
					...dropPosition,
				};
				facts.push({
					factId: drop.itemId,
					origin: {
						source,
						role: "output",
						roll: position,
					},
				});
				for (const { factId, condition } of readAvailabilityFactsFn(items, drop.rules))
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
};

const readOwnerFactsFn = (
	items: GameConfigSchema.Type["items"],
	item: ItemSchema.Type,
): ItemConnectionFact[] => {
	const facts: ItemConnectionFact[] = [];
	for (const [lineIndex, line] of item.lines.entries()) {
		const source: readItemConnectionFactsFn.Source = {
			type: "line",
			lineIndex,
			title: line.title,
		};
		for (const [inputIndex, input] of line.input.entries()) {
			const factId = readInputItemIdFn(input);
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
		for (const { factId, condition } of readAvailabilityFactsFn(items, line.rules))
			facts.push({
				factId,
				origin: {
					source,
					role: "condition",
					condition,
				},
			});
		addOutputFactsFn(items, facts, line.output, source);
	}
	if (item.action !== undefined) {
		const source = {
			type: "action",
		} as const;
		for (const [inputIndex, input] of item.action.input.entries()) {
			const factId = readInputItemIdFn(input);
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
		for (const { factId, condition } of readAvailabilityFactsFn(items, item.action.rules))
			facts.push({
				factId,
				origin: {
					source,
					role: "condition",
					condition,
				},
			});
	}
	for (const [mergeIndex, merge] of (item.merge ?? []).entries()) {
		const source = {
			type: "merge",
			mergeIndex,
		} as const;
		facts.push({
			factId: merge.target.itemId,
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
		addOutputFactsFn(items, facts, merge.output, source);
	}
	addOutputFactsFn(items, facts, item.units?.output, {
		type: "units",
	});
	if (item.clock !== undefined) {
		addOutputFactsFn(items, facts, item.clock.onExpire, {
			type: "expiry",
		});
		for (const { factId, condition } of readAvailabilityFactsFn(items, item.clock.rules))
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
		for (const fact of readOwnerFactsFn(config.items, owner)) {
			const isOutput = fact.origin.role === "output" || fact.origin.role === "replacement";
			if (isOutput !== outputs || (reverse && fact.factId !== factId)) continue;
			const itemId = reverse ? owner.id : fact.factId;
			if (itemId === factId) continue;
			let origins = connections.get(itemId);
			if (origins === undefined) {
				origins = new Map();
				connections.set(itemId, origins);
			}
			origins.set(JSON.stringify(fact.origin), fact.origin);
		}
	}
	return [
		...connections,
	]
		.sort(([left], [right]) => Order.String(left, right))
		.map(([itemId, origins]) => ({
			itemId,
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
				readonly type: "action" | "units" | "expiry" | "clock";
		  };

	export interface Origin {
		readonly source: Source;
		readonly role: "input" | "condition" | "output" | "replacement";
		readonly inputIndex?: number;
		readonly condition?: {
			readonly ruleIndex: number;
			readonly whenIndex: number;
		};
		readonly roll?: {
			readonly setIndex: number;
			readonly rollIndex: number;
			readonly dropIndex?: number;
			readonly candidateIndex?: number;
			readonly rollType: RollSchema.Type["type"];
		};
	}

	export interface Connection {
		readonly itemId: string;
		readonly origins: readonly Origin[];
	}
}
