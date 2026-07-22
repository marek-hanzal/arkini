import { Effect } from "effect";
import { match } from "ts-pattern";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { readItemDetailLinesFx } from "~/engine/item-detail/read/readItemDetailLinesFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";

export namespace readItemDetailSourcesFx {
	export interface Props {
		readonly itemId: IdSchema.Type;
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

const readMatchingFacts = ({
	output,
	targetDefinitionItemId,
}: {
	readonly output: readonly readItemDetailLinesFx.OutputSet[];
	readonly targetDefinitionItemId: IdSchema.Type;
}): readonly readItemDetailSourcesFx.OutputFact[] => {
	const totalSetWeight = output.reduce((total, set) => total + set.weight, 0);
	const facts: readItemDetailSourcesFx.OutputFact[] = [];

	for (const set of output) {
		for (const roll of set.roll) {
			match(roll)
				.with(
					{
						kind: "guaranteed",
					},
					({ item }) => {
						const target = item.find(
							(candidate) => candidate.itemId === targetDefinitionItemId,
						);
						if (target === undefined) return;
						facts.push({
							kind: "guaranteed",
							quantity: target.quantity,
							setWeight: set.weight,
							totalSetWeight,
						});
					},
				)
				.with(
					{
						kind: "chance",
					},
					({ chance, item }) => {
						const target = item.find(
							(candidate) => candidate.itemId === targetDefinitionItemId,
						);
						if (target === undefined) return;
						facts.push({
							kind: "chance",
							chance,
							quantity: target.quantity,
							setWeight: set.weight,
							totalSetWeight,
						});
					},
				)
				.with(
					{
						kind: "weight",
					},
					({ option, selections }) => {
						const totalOptionWeight = option.reduce(
							(total, candidate) => total + candidate.weight,
							0,
						);
						for (const candidate of option) {
							const target = candidate.item.find(
								(item) => item.itemId === targetDefinitionItemId,
							);
							if (target === undefined) continue;
							facts.push({
								kind: "weight",
								optionWeight: candidate.weight,
								quantity: target.quantity,
								selections,
								setWeight: set.weight,
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

/** Finds exact owned Board line owners that visibly produce the inspected canonical item. */
export const readItemDetailSourcesFx = Effect.fn("readItemDetailSourcesFx")(function* ({
	itemId,
	runtime,
}: readItemDetailSourcesFx.Props) {
	const target = runtime.items.find((candidate) => candidate.id === itemId);
	if (target === undefined) return unavailable;

	const source: readItemDetailSourcesFx.Source[] = [];
	for (const owner of runtime.items) {
		if (owner.location.scope !== LocationScopeEnumSchema.enum.Board) continue;
		const lines = yield* readItemDetailLinesFx({
			itemId: owner.id,
			runtime,
		});
		if (lines.kind === "unavailable") continue;
		const matchingLines = lines.line.flatMap((line) => {
			const output = readMatchingFacts({
				output: line.output,
				targetDefinitionItemId: target.item.id,
			});
			return output.length === 0
				? []
				: [
						{
							lineId: line.lineId,
							title: line.title,
							output,
						} satisfies readItemDetailSourcesFx.Line,
					];
		});
		if (matchingLines.length === 0) continue;
		source.push({
			ownerItemId: owner.id,
			ownerDefinitionItemId: owner.item.id,
			space: owner.location.space,
			line: matchingLines,
		});
	}

	source.sort((left, right) => {
		const leftCurrent = left.space === runtime.currentSpace;
		const rightCurrent = right.space === runtime.currentSpace;
		if (leftCurrent !== rightCurrent) return leftCurrent ? -1 : 1;
		if (left.space !== right.space) return left.space - right.space;
		const leftTitle =
			runtime.items.find((item) => item.id === left.ownerItemId)?.item.title ?? "";
		const rightTitle =
			runtime.items.find((item) => item.id === right.ownerItemId)?.item.title ?? "";
		const titleOrder = leftTitle.localeCompare(rightTitle);
		return titleOrder === 0 ? left.ownerItemId.localeCompare(right.ownerItemId) : titleOrder;
	});

	return {
		kind: "available",
		itemId: target.id,
		targetDefinitionItemId: target.item.id,
		source,
	} satisfies readItemDetailSourcesFx.Result;
});
