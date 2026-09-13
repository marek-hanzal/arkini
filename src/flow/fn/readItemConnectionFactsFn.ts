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

const readAvailabilityFactIdsFn = (
	rules: ReadonlyArray<{
		readonly type: string;
		readonly when: ReadonlyArray<WhenSchema.Type>;
	}>,
) => {
	const requirements = readAcquisitionAvailabilityRequirementsFn({
		rules,
		source: "line-condition",
	});
	return [
		...requirements.allOf,
		...requirements.anyOf.flat(),
	].map(({ factId }) => factId);
};

const addOutputFactsFn = (
	facts: ItemConnectionFact[],
	output: OutputSchema.Type | undefined,
	source: readItemConnectionFactsFn.Source,
) => {
	if (output === undefined) return;
	for (const [setIndex, set] of output.set.entries())
		for (const [rollIndex, roll] of set.roll.entries()) {
			const position = {
				setIndex,
				rollIndex,
				rollType: roll.type,
			};
			const drops =
				roll.type === "weight"
					? roll.drop.flatMap((candidate) => candidate.drop)
					: roll.drop;
			for (const drop of drops) {
				facts.push({
					factId: drop.itemId,
					origin: {
						source,
						role: "output",
						roll: position,
					},
				});
				for (const factId of readAvailabilityFactIdsFn(drop.rules))
					facts.push({
						factId,
						origin: {
							source,
							role: "condition",
							roll: position,
						},
					});
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
		for (const input of line.input) {
			const factId = readInputItemIdFn(input);
			if (factId !== undefined)
				facts.push({
					factId,
					origin: {
						source,
						role: "input",
					},
				});
		}
		for (const factId of readAvailabilityFactIdsFn(line.rules))
			facts.push({
				factId,
				origin: {
					source,
					role: "condition",
				},
			});
		addOutputFactsFn(facts, line.output, source);
	}
	if (item.action !== undefined) {
		const source = {
			type: "action",
		} as const;
		for (const input of item.action.input) {
			const factId = readInputItemIdFn(input);
			if (factId !== undefined)
				facts.push({
					factId,
					origin: {
						source,
						role: "input",
					},
				});
		}
		for (const factId of readAvailabilityFactIdsFn(item.action.rules))
			facts.push({
				factId,
				origin: {
					source,
					role: "condition",
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
		addOutputFactsFn(facts, merge.output, source);
	}
	addOutputFactsFn(facts, item.units?.output, {
		type: "units",
	});
	if (item.clock !== undefined) {
		addOutputFactsFn(facts, item.clock.onExpire, {
			type: "expiry",
		});
		for (const factId of readAvailabilityFactIdsFn(item.clock.rules))
			facts.push({
				factId,
				origin: {
					source: {
						type: "clock",
					},
					role: "condition",
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
		readonly roll?: {
			readonly setIndex: number;
			readonly rollIndex: number;
			readonly rollType: RollSchema.Type["type"];
		};
	}

	export interface Connection {
		readonly itemId: string;
		readonly origins: readonly Origin[];
	}
}
