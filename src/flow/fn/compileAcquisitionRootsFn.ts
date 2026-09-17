import { Order } from "effect";

import type { AcquisitionGraph, AcquisitionLimitation } from "~/flow/type/AcquisitionGraph";
import type { OutputSchema } from "~/production-output/schema/OutputSchema";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { WhenSchema } from "~/production-condition/schema/WhenSchema";

const readOutputDropsFn = (output: OutputSchema.Type | undefined) =>
	output?.set.flatMap((set) => set.roll.flatMap((roll) => roll.drop)) ?? [];

const readOutputSetRulesFn = (output: OutputSchema.Type | undefined) =>
	output?.set.flatMap((set) => set.rules) ?? [];

const requiresAbsentFactFn = (when: WhenSchema.Type, config: GameConfigSchema.Type) => {
	switch (when.type) {
		case "limit":
			return config.items[when.itemId]?.maxCount !== undefined;
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
		...item.lines.map(({ output }) => output),
		item.units?.output,
		...(item.merge ?? []).map(({ output }) => output),
		item.clock?.onExpire,
	];
};

const readLimitationsFn = (config: GameConfigSchema.Type) => {
	const limitations = new Set<AcquisitionLimitation>();
	for (const item of Object.values(config.items)) {
		for (const line of item.lines) {
			if (
				line.rules.some(
					(rule) =>
						rule.type === "disable" &&
						rule.when.some((when) => requiresAbsentFactFn(when, config)),
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
				line.input.some(({ type }) => type === "units") ||
				line.rules.some(({ when }) => when.some(({ type }) => type !== "limit"))
			)
				limitations.add("spatial-requirements-approximated");
		}
		if (
			readItemOutputsFn(item).some((output) => {
				const rules = [
					...readOutputSetRulesFn(output),
					...readOutputDropsFn(output).flatMap((drop) => drop.rules),
				];
				if (
					rules.some(
						(rule) =>
							rule.type === "disable" &&
							rule.when.some((when) => requiresAbsentFactFn(when, config)),
					)
				)
					limitations.add("negative-availability-constraints-ignored");
				return rules.some(({ when }) => when.some(({ type }) => type !== "limit"));
			})
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
