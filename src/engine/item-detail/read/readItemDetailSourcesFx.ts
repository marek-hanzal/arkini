import { Effect, Option } from "effect";
import { match } from "ts-pattern";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { resolveItemFx } from "~/engine/item/fx/resolveItemFx";
import { RuntimeFx } from "~/engine/runtime/context/RuntimeFx";
import { lineRulesFx } from "~/engine/line/fx/lineRulesFx";
import { resolveLineShowFx } from "~/engine/line/fx/run/resolveLineShowFx";
import { isLineOwnerItem } from "~/engine/line/read/isLineOwnerItem";
import { readLineOwnerLines } from "~/engine/line/read/readLineOwnerLines";
import { RuleEnumSchema } from "~/engine/line/schema/rule/RuleEnumSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import type { DropSchema } from "~/engine/output/schema/DropSchema";
import type { OutputSchema } from "~/engine/output/schema/OutputSchema";
import type { QuantitySchema } from "~/engine/quantity/schema/QuantitySchema";
import { RollEnumSchema } from "~/engine/roll/schema/RollEnumSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace readItemDetailSourcesFx {
	export interface Props {
		readonly target:
			| {
					readonly kind: "runtime";
					readonly itemId: IdSchema.Type;
			  }
			| {
					readonly kind: "definition";
					readonly itemId: IdSchema.Type;
			  };
		readonly runtime: RuntimeSchema.Type;
	}

	export interface QuantityBounds {
		readonly min: number;
		readonly max: number;
	}

	export type OutputFact =
		| {
				readonly kind: "guaranteed";
				readonly quantity: QuantityBounds;
				readonly setWeight: number;
				readonly totalSetWeight: number;
		  }
		| {
				readonly kind: "chance";
				readonly chance: number;
				readonly quantity: QuantityBounds;
				readonly setWeight: number;
				readonly totalSetWeight: number;
		  }
		| {
				readonly kind: "weight";
				readonly optionWeight: number;
				readonly quantity: QuantityBounds;
				readonly selections: QuantityBounds;
				readonly setWeight: number;
				readonly totalOptionWeight: number;
				readonly totalSetWeight: number;
		  };

	export interface Line {
		readonly lineId: IdSchema.Type;
		readonly title: string;
		readonly output: readonly OutputFact[];
	}

	export interface Source {
		readonly ownerItemId: IdSchema.Type;
		readonly ownerDefinitionItemId: IdSchema.Type;
		readonly space: number;
		readonly line: readonly Line[];
	}

	export type Result =
		| {
				readonly kind: "available";
				readonly itemId: IdSchema.Type;
				readonly targetDefinitionItemId: IdSchema.Type;
				readonly source: readonly Source[];
		  }
		| {
				readonly kind: "unavailable";
		  };
}

const unavailable = {
	kind: "unavailable",
} as const satisfies readItemDetailSourcesFx.Result;

const quantityBounds = (quantity: QuantitySchema.Type): readItemDetailSourcesFx.QuantityBounds =>
	match(quantity)
		.with(
			{
				type: "value",
			},
			({ value }) => ({
				min: value,
				max: value,
			}),
		)
		.with(
			{
				type: "range",
			},
			({ max, min }) => ({
				min,
				max,
			}),
		)
		.exhaustive();

const targetQuantity = ({
	drop,
	targetDefinitionItemId,
}: {
	readonly drop: readonly DropSchema.Type[];
	readonly targetDefinitionItemId: IdSchema.Type;
}): readItemDetailSourcesFx.QuantityBounds | undefined => {
	let min = 0;
	let max = 0;
	let found = false;
	for (const candidate of drop) {
		if (candidate.itemId !== targetDefinitionItemId) continue;
		const bounds = quantityBounds(candidate.quantity);
		min += bounds.min;
		max += bounds.max;
		found = true;
	}
	return found
		? {
				min,
				max,
			}
		: undefined;
};

const readMatchingFacts = ({
	output,
	targetDefinitionItemId,
}: {
	readonly output: OutputSchema.Type | undefined;
	readonly targetDefinitionItemId: IdSchema.Type;
}): readonly readItemDetailSourcesFx.OutputFact[] => {
	if (output === undefined) return [];
	const totalSetWeight = output.set.reduce((total, set) => total + (set.weight ?? 1), 0);
	const facts: readItemDetailSourcesFx.OutputFact[] = [];

	for (const set of output.set) {
		const setWeight = set.weight ?? 1;
		for (const roll of set.roll) {
			match(roll)
				.with(
					{
						type: RollEnumSchema.enum.Guaranteed,
					},
					({ drop }) => {
						const quantity = targetQuantity({
							drop,
							targetDefinitionItemId,
						});
						if (quantity === undefined) return;
						facts.push({
							kind: "guaranteed",
							quantity,
							setWeight,
							totalSetWeight,
						});
					},
				)
				.with(
					{
						type: RollEnumSchema.enum.Chance,
					},
					({ chance, drop }) => {
						const quantity = targetQuantity({
							drop,
							targetDefinitionItemId,
						});
						if (quantity === undefined) return;
						facts.push({
							kind: "chance",
							chance,
							quantity,
							setWeight,
							totalSetWeight,
						});
					},
				)
				.with(
					{
						type: RollEnumSchema.enum.Weight,
					},
					({ drop, quantity: selections }) => {
						const totalOptionWeight = drop.reduce(
							(total, candidate) => total + candidate.weight,
							0,
						);
						for (const candidate of drop) {
							const quantity = targetQuantity({
								drop: candidate.drop,
								targetDefinitionItemId,
							});
							if (quantity === undefined) continue;
							facts.push({
								kind: "weight",
								optionWeight: candidate.weight,
								quantity,
								selections: quantityBounds(selections),
								setWeight,
								totalOptionWeight,
								totalSetWeight,
							});
						}
					},
				)
				.exhaustive();
		}
	}

	return facts;
};

interface OrderedSource extends readItemDetailSourcesFx.Source {
	readonly ownerTitle: string;
}

/** Finds exact owned Board line owners that visibly produce the inspected canonical item. */
export const readItemDetailSourcesFx = Effect.fn("readItemDetailSourcesFx")(function* ({
	runtime,
	target,
}: readItemDetailSourcesFx.Props) {
	const targetItem =
		target.kind === "runtime"
			? runtime.items.find((candidate) => candidate.id === target.itemId)
			: undefined;
	if (target.kind === "runtime" && targetItem === undefined) return unavailable;
	let targetDefinitionItemId = targetItem?.item.id;
	if (target.kind === "definition") {
		const configuredTarget = yield* resolveItemFx({
			itemId: target.itemId,
		}).pipe(Effect.option);
		if (Option.isNone(configuredTarget)) return unavailable;
		targetDefinitionItemId = configuredTarget.value.id;
	}
	if (targetDefinitionItemId === undefined) return unavailable;

	const activeLine = new Set(runtime.jobs.map((job) => `${job.ownerItemId}\u0000${job.lineId}`));
	const source: OrderedSource[] = [];
	for (const owner of runtime.items) {
		if (
			owner.location.scope !== LocationScopeEnumSchema.enum.Board ||
			!isLineOwnerItem(owner.item)
		) {
			continue;
		}
		const lines = readLineOwnerLines(owner.item);
		const matchingLines: readItemDetailSourcesFx.Line[] = [];
		for (const line of lines) {
			const output = readMatchingFacts({
				output: line.output,
				targetDefinitionItemId,
			});
			if (output.length === 0) continue;
			const visibilityRules = line.rules.filter(
				(rule) =>
					rule.type === RuleEnumSchema.enum.Show ||
					rule.type === RuleEnumSchema.enum.Hide,
			);
			let visible = line.show;
			if (visibilityRules.length > 0) {
				const rules = yield* lineRulesFx({
					origin: owner.location,
					rules: visibilityRules,
				}).pipe(
					Effect.provideService(RuntimeFx, {
						read: Effect.succeed(runtime),
					}),
				);
				visible = yield* resolveLineShowFx({
					line,
					rules,
				});
			}
			visible ||= activeLine.has(`${owner.id}\u0000${line.id}`);
			if (!visible) continue;
			matchingLines.push({
				lineId: line.id,
				title: line.title,
				output,
			});
		}
		if (matchingLines.length === 0) continue;
		source.push({
			ownerItemId: owner.id,
			ownerDefinitionItemId: owner.item.id,
			ownerTitle: owner.item.title,
			space: owner.location.space,
			line: matchingLines,
		});
	}

	source.sort((left, right) => {
		const leftCurrent = left.space === runtime.currentSpace;
		const rightCurrent = right.space === runtime.currentSpace;
		if (leftCurrent !== rightCurrent) return leftCurrent ? -1 : 1;
		if (left.space !== right.space) return left.space - right.space;
		const titleOrder = left.ownerTitle.localeCompare(right.ownerTitle);
		return titleOrder === 0 ? left.ownerItemId.localeCompare(right.ownerItemId) : titleOrder;
	});

	return {
		kind: "available",
		itemId: target.itemId,
		targetDefinitionItemId,
		source: source.map(({ ownerTitle: _, ...ordered }) => ordered),
	} satisfies readItemDetailSourcesFx.Result;
});
