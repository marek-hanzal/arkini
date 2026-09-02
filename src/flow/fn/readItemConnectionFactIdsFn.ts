import { Order } from "effect";

import { readAcquisitionAvailabilityRequirementsFn } from "~/flow/fn/readAcquisitionAvailabilityRequirementsFn";
import type { ItemConnectionFilter } from "~/flow/type/ItemConnectionFilter";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { readAuthoredItemLinesFn } from "~/production-line/fn/readAuthoredItemLinesFn";
import type { InputSchema as LineInputSchema } from "~/production-input/schema/InputSchema";
import type { InputSchema as ActionInputSchema } from "~/production-action/schema/InputSchema";
import type { WhenSchema } from "~/production-condition/schema/WhenSchema";
import type { DropSchema } from "~/production-output/schema/DropSchema";
import type { OutputSchema } from "~/production-output/schema/OutputSchema";

interface ItemConnectionFacts {
	readonly inputs: Set<string>;
	readonly outputs: Set<string>;
}

const readInputItemIdFn = (input: LineInputSchema.Type | ActionInputSchema.Type) => {
	switch (input.type) {
		case "simple":
			return undefined;
		case "materials":
			return input.selector.itemId;
		case "deposit":
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

const readOutputDropsFn = (output: OutputSchema.Type): DropSchema.Type[] => {
	const drops: DropSchema.Type[] = [];
	for (const set of output.set)
		for (const roll of set.roll) {
			if (roll.type === "weight") {
				for (const candidate of roll.drop) drops.push(...candidate.drop);
				continue;
			}
			drops.push(...roll.drop);
		}
	return drops;
};

const addOutputFactsFn = (facts: ItemConnectionFacts, output: OutputSchema.Type | undefined) => {
	if (output === undefined) return;
	for (const drop of readOutputDropsFn(output)) {
		facts.outputs.add(drop.itemId);
		for (const conditionFactId of readAvailabilityFactIdsFn(drop.rules))
			facts.inputs.add(conditionFactId);
	}
};

const readItemConnectionFactsFn = (item: ItemSchema.Type): ItemConnectionFacts => {
	const facts: ItemConnectionFacts = {
		inputs: new Set<string>(),
		outputs: new Set<string>(),
	};
	for (const line of readAuthoredItemLinesFn(item)) {
		for (const input of line.input) {
			const inputItemId = readInputItemIdFn(input);
			if (inputItemId !== undefined) facts.inputs.add(inputItemId);
		}
		for (const conditionFactId of readAvailabilityFactIdsFn(line.rules))
			facts.inputs.add(conditionFactId);
		addOutputFactsFn(facts, line.output);
	}
	if (item.type === "space") {
		for (const input of item.input) {
			const inputItemId = readInputItemIdFn(input);
			if (inputItemId !== undefined) facts.inputs.add(inputItemId);
		}
		for (const conditionFactId of readAvailabilityFactIdsFn(item.rules))
			facts.inputs.add(conditionFactId);
	}
	for (const merge of item.merge ?? []) {
		facts.inputs.add(merge.target.itemId);
		if (merge.effect === "replace") facts.outputs.add(merge.result);
		addOutputFactsFn(facts, merge.output);
	}
	addOutputFactsFn(facts, item.charges?.output);
	if (item.type === "temporary") addOutputFactsFn(facts, item.output);
	return facts;
};

/** Reads one complete authored connection projection without runtime reachability filtering. */
export const readItemConnectionFactIdsFn = (
	config: GameConfigSchema.Type,
	factId: string,
	filter: ItemConnectionFilter,
) => {
	const factsByOwnerId = new Map(
		Object.values(config.items).map((item) => [
			item.id,
			readItemConnectionFactsFn(item),
		]),
	);
	const connectedFactIds = new Set<string>();
	if (filter === "required-by") {
		for (const [ownerItemId, facts] of factsByOwnerId)
			if (facts.inputs.has(factId)) connectedFactIds.add(ownerItemId);
	} else {
		const facts = factsByOwnerId.get(factId);
		for (const connectedFactId of filter === "inputs"
			? (facts?.inputs ?? [])
			: (facts?.outputs ?? []))
			connectedFactIds.add(connectedFactId);
	}
	connectedFactIds.delete(factId);
	return [
		...connectedFactIds,
	].sort(Order.String);
};
