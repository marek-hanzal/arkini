import { Effect, Option } from "effect";
import { match } from "ts-pattern";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { GameConfigFx } from "~/engine/game/context/GameConfigFx";
import { RuntimeFx } from "~/engine/runtime/context/RuntimeFx";
import { lineRulesFx } from "~/engine/line/fx/lineRulesFx";
import { resolveLineShowFx } from "~/engine/line/fx/run/resolveLineShowFx";
import { isLineOwnerItemFx } from "~/engine/line/read/isLineOwnerItemFx";
import { readLineOwnerLinesFx } from "~/engine/line/read/readLineOwnerLinesFx";
import { TypeSchema as LineRuleTypeSchema } from "~/engine/line/schema/rule/TypeSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import type { DropSchema } from "~/engine/output/schema/DropSchema";
import type { OutputSchema } from "~/engine/output/schema/OutputSchema";
import type { QuantitySchema } from "~/engine/quantity/schema/QuantitySchema";
import { TypeSchema as RollTypeSchema } from "~/engine/roll/schema/TypeSchema";
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
		readonly space?: number;
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
	quantity;

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
	const totalSetWeight = output.set.reduce((total, set) => total + set.weight, 0);
	const facts: readItemDetailSourcesFx.OutputFact[] = [];

	for (const set of output.set) {
		const setWeight = set.weight;
		for (const roll of set.roll) {
			match(roll)
				.with(
					{
						type: RollTypeSchema.enum.Guaranteed,
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
						type: RollTypeSchema.enum.Chance,
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
						type: RollTypeSchema.enum.Weight,
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

const readOwnedSourcesFx = Effect.fn("readOwnedItemDetailSourcesFx")(function* ({
	runtime,
	targetDefinitionItemId,
}: {
	readonly runtime: RuntimeSchema.Type;
	readonly targetDefinitionItemId: IdSchema.Type;
}) {
	const activeLine = new Set(runtime.jobs.map((job) => `${job.ownerItemId}\u0000${job.lineId}`));
	const source: OrderedSource[] = [];
	for (const owner of runtime.items) {
		const ownerItem = Option.getOrUndefined(yield* isLineOwnerItemFx(owner.item));
		if (ownerItem === undefined) continue;
		const boardLocation =
			owner.location.scope === LocationScopeEnumSchema.enum.Board
				? owner.location
				: undefined;
		const lines = yield* readLineOwnerLinesFx(ownerItem);
		const matchingLines: readItemDetailSourcesFx.Line[] = [];
		for (const line of lines) {
			const output = readMatchingFacts({
				output: line.output,
				targetDefinitionItemId,
			});
			if (output.length === 0) continue;
			if (boardLocation !== undefined) {
				const visibilityRules = line.rules.filter(
					(rule) =>
						rule.type === LineRuleTypeSchema.enum.Show ||
						rule.type === LineRuleTypeSchema.enum.Hide,
				);
				let visible = line.show;
				if (visibilityRules.length > 0) {
					const rules = yield* lineRulesFx({
						origin: boardLocation,
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
			}
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
			...(boardLocation === undefined
				? {}
				: {
						space: boardLocation.space,
					}),
			line: matchingLines,
		});
	}

	source.sort((left, right) => {
		const leftOnBoard = left.space !== undefined;
		const rightOnBoard = right.space !== undefined;
		if (leftOnBoard !== rightOnBoard) return leftOnBoard ? -1 : 1;
		if (!leftOnBoard || !rightOnBoard) {
			const titleOrder = left.ownerTitle.localeCompare(right.ownerTitle);
			if (titleOrder !== 0) return titleOrder;
			const definitionOrder = left.ownerDefinitionItemId.localeCompare(
				right.ownerDefinitionItemId,
			);
			return definitionOrder === 0
				? left.ownerItemId.localeCompare(right.ownerItemId)
				: definitionOrder;
		}
		const leftCurrent = left.space === runtime.currentSpace;
		const rightCurrent = right.space === runtime.currentSpace;
		if (leftCurrent !== rightCurrent) return leftCurrent ? -1 : 1;
		if (left.space !== right.space) return left.space - right.space;
		const titleOrder = left.ownerTitle.localeCompare(right.ownerTitle);
		return titleOrder === 0 ? left.ownerItemId.localeCompare(right.ownerItemId) : titleOrder;
	});
	return source;
});

/** Finds owned direct sources, resolving one unowned acquisition item hop when necessary. */
export const readItemDetailSourcesFx = Effect.fn("readItemDetailSourcesFx")(function* ({
	runtime,
	target,
}: readItemDetailSourcesFx.Props) {
	const targetItem =
		target.kind === "runtime"
			? runtime.items.find((candidate) => candidate.id === target.itemId)
			: undefined;
	if (target.kind === "runtime" && targetItem === undefined) return unavailable;
	const config = yield* GameConfigFx;
	let targetDefinitionItemId =
		target.kind === "runtime" ? targetItem?.item.id : config.items[target.itemId]?.id;
	if (targetDefinitionItemId === undefined) return unavailable;
	const requestedDefinitionItemId = targetDefinitionItemId;

	let source = yield* readOwnedSourcesFx({
		runtime,
		targetDefinitionItemId,
	});
	if (source.length === 0) {
		for (const candidate of Object.values(config.items)) {
			const owner = Option.getOrUndefined(yield* isLineOwnerItemFx(candidate));
			if (owner === undefined || owner.id === targetDefinitionItemId) continue;
			const lines = yield* readLineOwnerLinesFx(owner);
			if (
				!lines.some(
					(line) =>
						readMatchingFacts({
							output: line.output,
							targetDefinitionItemId: requestedDefinitionItemId,
						}).length > 0,
				)
			) {
				continue;
			}
			const acquiredFrom = yield* readOwnedSourcesFx({
				runtime,
				targetDefinitionItemId: owner.id,
			});
			if (acquiredFrom.length === 0) continue;
			targetDefinitionItemId = owner.id;
			source = acquiredFrom;
			break;
		}
	}

	return {
		kind: "available",
		itemId: target.itemId,
		targetDefinitionItemId,
		source: source.map(({ ownerTitle: _, ...ordered }) => ordered),
	} satisfies readItemDetailSourcesFx.Result;
});
