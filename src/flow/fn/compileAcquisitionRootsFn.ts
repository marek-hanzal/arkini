import { Order } from "effect";

import type { AcquisitionGraph, AcquisitionLimitation } from "~/flow/type/AcquisitionGraph";
import { readAuthoredItemLinesFn } from "~/production-line/fn/readAuthoredItemLinesFn";
import type { OutputSchema } from "~/production-output/schema/OutputSchema";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { WhenSchema } from "~/production-condition/schema/WhenSchema";

const readOutputDropsFn = (output: OutputSchema.Type | undefined) =>
	output?.set.flatMap((set) =>
		set.roll.flatMap((roll) =>
			roll.type === "weight" ? roll.drop.flatMap((candidate) => candidate.drop) : roll.drop,
		),
	) ?? [];

const requiresAbsentFactFn = (when: WhenSchema.Type) => {
	switch (when.type) {
		case "exists":
			return true;
		case "count":
			return when.count > 0;
		case "range":
			return when.min > 0;
	}
};

const readItemOutputsFn = (item: ItemSchema.Type) => {
	return [
		...readAuthoredItemLinesFn(item).map(({ output }) => output),
		item.charges?.output,
		...(item.merge ?? []).map(({ output }) => output),
		item.type === "temporary" ? item.output : undefined,
	];
};

const readLimitationsFn = (config: GameConfigSchema.Type) => {
	const limitations = new Set<AcquisitionLimitation>();
	for (const item of Object.values(config.items)) {
		for (const line of readAuthoredItemLinesFn(item)) {
			if (
				line.rules.some(
					(rule) => rule.type === "disable" && rule.when.some(requiresAbsentFactFn),
				)
			)
				limitations.add("negative-availability-constraints-ignored");
			if (
				line.rules.some(
					({ type }) => type === "runtime:adjust" || type === "runtime:multiplier",
				)
			)
				limitations.add("conditional-runtime-adjustments-ignored");
			if (
				line.input.some(({ type }) => type === "deposit") ||
				line.rules.some(({ when }) => when.length > 0)
			)
				limitations.add("spatial-requirements-approximated");
		}
		if (
			readItemOutputsFn(item).some((output) =>
				readOutputDropsFn(output).some(({ rules }) => {
					if (
						rules.some(
							(rule) =>
								rule.type === "disable" && rule.when.some(requiresAbsentFactFn),
						)
					)
						limitations.add("negative-availability-constraints-ignored");
					return rules.length > 0;
				}),
			)
		)
			limitations.add("spatial-requirements-approximated");
	}
	return [
		...limitations,
	].sort(Order.String);
};

const addStartQuantityFn = (quantities: Map<string, number>, itemId: string, quantity = 1) =>
	quantities.set(itemId, (quantities.get(itemId) ?? 0) + quantity);

const readStartQuantityByItemIdFn = (config: GameConfigSchema.Type) => {
	const quantities = new Map<string, number>();
	for (const item of config.start.board)
		addStartQuantityFn(quantities, item.itemId, item.quantity);
	for (const item of config.start.inventory)
		addStartQuantityFn(quantities, item.itemId, item.quantity);
	for (const item of config.start.toolbar)
		addStartQuantityFn(quantities, item.itemId, item.quantity);
	return quantities;
};

/** Compiles authored starting quantities and static-analysis limitations. */
export const compileAcquisitionRootsFn = (config: GameConfigSchema.Type) => {
	const start = readStartQuantityByItemIdFn(config);
	return {
		limitations: readLimitationsFn(config),
		roots: [
			...start,
		]
			.sort(([left], [right]) => Order.String(left, right))
			.map(([factId, quantity]) => ({
				factId,
				quantity,
			})),
	} satisfies Pick<AcquisitionGraph, "limitations" | "roots">;
};
