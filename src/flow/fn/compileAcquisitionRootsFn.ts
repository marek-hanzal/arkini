import { readStartBoardFn } from "~/game-start/fn/readStartBoardFn";
import { Order } from "effect";

import type { AcquisitionGraph, AcquisitionLimitation } from "~/flow/type/AcquisitionGraph";
import type { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { WhenSchema } from "~/production-condition/schema/WhenSchema";

const readOutputDropsFn = (output: OutcomeTableSchema.Type | undefined) =>
	output?.set.flatMap((set) => set.roll.flatMap((roll) => roll.outcome)) ?? [];

const readOutputSetRulesFn = (output: OutcomeTableSchema.Type | undefined) =>
	output?.set.flatMap((set) => set.rules) ?? [];

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
		...item.lines.map(({ outcome }) => outcome),
		item.units?.outcome,
		...(item.merge ?? []).map(({ outcome }) => outcome),
		item.clock?.onExpire,
	];
};

const readLimitationsFn = (config: GameConfigSchema.Type) => {
	const limitations = new Set<AcquisitionLimitation>();
	for (const item of Object.values(config.items)) {
		if (
			readItemOutputsFn(item).some((output) =>
				readOutputDropsFn(output).some((outcome) => outcome.type === "template"),
			)
		)
			limitations.add("template-resets-not-simulated");
		for (const line of item.lines) {
			if (
				line.rules.some(
					(rule) =>
						rule.type === "disable" &&
						rule.when.some((when) => requiresAbsentFactFn(when)),
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
				line.rules.some(({ when }) => when.length > 0)
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
							rule.when.some((when) => requiresAbsentFactFn(when)),
					)
				)
					limitations.add("negative-availability-constraints-ignored");
				return rules.some(({ when }) => when.length > 0);
			})
		)
			limitations.add("spatial-requirements-approximated");
	}
	return [
		...limitations,
	].sort(Order.String);
};

const addStartQuantityFn = (quantities: Map<string, number>, itemUid: string) =>
	quantities.set(itemUid, (quantities.get(itemUid) ?? 0) + 1);

const readStartQuantityByItemUidFn = (config: GameConfigSchema.Type) => {
	const quantities = new Map<string, number>();
	for (const item of readStartBoardFn(config)) addStartQuantityFn(quantities, item.itemUid);
	return quantities;
};

/** Compiles authored starting quantities and static-analysis limitations. */
export const compileAcquisitionRootsFn = (config: GameConfigSchema.Type) => {
	const start = readStartQuantityByItemUidFn(config);
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
