import { Effect } from "effect";

import type {
	EditorAcquisitionGraph,
	EditorAcquisitionLimitation,
} from "~/editor/EditorAcquisitionGraph";
import { readAuthoredItemLinesFx } from "~/engine/line/read/readAuthoredItemLinesFx";
import type { OutputSchema } from "~/engine/output/schema/OutputSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { WhenSchema } from "~/engine/when/schema/WhenSchema";

const readOutputDrops = (output: OutputSchema.Type | undefined) =>
	output?.set.flatMap((set) =>
		set.roll.flatMap((roll) =>
			roll.type === "weight" ? roll.drop.flatMap((candidate) => candidate.drop) : roll.drop,
		),
	) ?? [];

const requiresAbsentFact = (when: WhenSchema.Type) => {
	switch (when.type) {
		case "exists":
			return true;
		case "count":
			return when.count > 0;
		case "range":
			return when.min > 0;
	}
};

const readItemOutputsFx = Effect.fn("compileEditorAcquisitionRootsFx.itemOutputs")(function* (
	item: ItemSchema.Type,
) {
	return [
		...(yield* readAuthoredItemLinesFx(item)).map(({ output }) => output),
		item.charges?.output,
		...(item.merge ?? []).map(({ output }) => output),
		item.type === "temporary" ? item.output : undefined,
	];
});

const readLimitationsFx = Effect.fn("compileEditorAcquisitionRootsFx.limitations")(function* (
	config: GameConfigSchema.Type,
) {
	const limitations = new Set<EditorAcquisitionLimitation>();
	for (const item of Object.values(config.items)) {
		for (const line of yield* readAuthoredItemLinesFx(item)) {
			if (
				line.rules.some(
					(rule) => rule.type === "disable" && rule.when.some(requiresAbsentFact),
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
			(yield* readItemOutputsFx(item)).some((output) =>
				readOutputDrops(output).some(({ rules }) => {
					if (
						rules.some(
							(rule) => rule.type === "disable" && rule.when.some(requiresAbsentFact),
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
	].sort((left, right) => left.localeCompare(right));
});

const readStartQuantityByItemId = (config: GameConfigSchema.Type) => {
	const quantities = new Map<string, number>();
	const add = (itemId: string, quantity = 1) =>
		quantities.set(itemId, (quantities.get(itemId) ?? 0) + quantity);
	for (const item of config.start.board) add(item.itemId, item.quantity);
	for (const item of config.start.inventory) add(item.itemId, item.quantity);
	for (const item of config.start.toolbar) add(item.itemId, item.quantity);
	return quantities;
};

/** Compiles authored starting quantities and static-analysis limitations. */
export const compileEditorAcquisitionRootsFx = Effect.fn("compileEditorAcquisitionRootsFx")(
	function* (config: GameConfigSchema.Type) {
		const start = readStartQuantityByItemId(config);
		return {
			limitations: yield* readLimitationsFx(config),
			roots: [
				...start,
			]
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([factId, quantity]) => ({
					factId,
					quantity,
				})),
		} satisfies Pick<EditorAcquisitionGraph, "limitations" | "roots">;
	},
);
