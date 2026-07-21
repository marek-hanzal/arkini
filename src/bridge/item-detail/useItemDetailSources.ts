import { useCallback } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import { useRuntimeSelector } from "~/bridge/runtime/useRuntimeSelector";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { readItemDetailSourcesFx } from "~/engine/item-detail/read/readItemDetailSourcesFx";
import { readRuntimeItemPrimaryAssetId } from "~/engine/item/read/readRuntimeItemPrimaryAssetId";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace useItemDetailSources {
	export type OutputFact = readItemDetailSourcesFx.OutputFact;

	export interface Line {
		readonly lineId: string;
		readonly title: string;
		readonly output: readonly OutputFact[];
	}

	export interface Source {
		readonly ownerItemId: string;
		readonly title: string;
		readonly sourceUrl: string;
		readonly compositeUrl?: string;
		readonly space: number;
		readonly line: readonly Line[];
	}

	export type Projection =
		| {
				readonly kind: "available";
				readonly itemId: string;
				readonly targetTitle: string;
				readonly source: readonly Source[];
		  }
		| {
				readonly kind: "unavailable";
		  };
}

const unavailable = {
	kind: "unavailable",
} as const satisfies useItemDetailSources.Projection;

const sameQuantity = (
	left: readItemDetailSourcesFx.QuantityBounds,
	right: readItemDetailSourcesFx.QuantityBounds,
) => left.min === right.min && left.max === right.max;

const sameOutputFact = (
	left: useItemDetailSources.OutputFact,
	right: useItemDetailSources.OutputFact,
) => {
	if (
		left.kind !== right.kind ||
		!sameQuantity(left.quantity, right.quantity) ||
		left.setWeight !== right.setWeight ||
		left.totalSetWeight !== right.totalSetWeight
	) {
		return false;
	}
	if (left.kind === "guaranteed" || right.kind === "guaranteed") return true;
	if (left.kind === "chance" && right.kind === "chance") return left.chance === right.chance;
	return (
		left.kind === "weight" &&
		right.kind === "weight" &&
		left.optionWeight === right.optionWeight &&
		left.totalOptionWeight === right.totalOptionWeight &&
		sameQuantity(left.selections, right.selections)
	);
};

const sameLine = (left: useItemDetailSources.Line, right: useItemDetailSources.Line) =>
	left.lineId === right.lineId &&
	left.title === right.title &&
	left.output.length === right.output.length &&
	left.output.every(
		(output, index) =>
			right.output[index] !== undefined && sameOutputFact(output, right.output[index]),
	);

const sameSource = (left: useItemDetailSources.Source, right: useItemDetailSources.Source) =>
	left.ownerItemId === right.ownerItemId &&
	left.title === right.title &&
	left.sourceUrl === right.sourceUrl &&
	left.compositeUrl === right.compositeUrl &&
	left.space === right.space &&
	left.line.length === right.line.length &&
	left.line.every(
		(line, index) => right.line[index] !== undefined && sameLine(line, right.line[index]),
	);

const sameProjection = (
	left: useItemDetailSources.Projection,
	right: useItemDetailSources.Projection,
) => {
	if (left.kind !== right.kind) return false;
	if (left.kind === "unavailable" || right.kind === "unavailable") return true;
	return (
		left.itemId === right.itemId &&
		left.targetTitle === right.targetTitle &&
		left.source.length === right.source.length &&
		left.source.every(
			(source, index) =>
				right.source[index] !== undefined && sameSource(source, right.source[index]),
		)
	);
};

/** Projects exact owned Board sources that visibly produce one inspected live item. */
export const useItemDetailSources = (itemId: IdSchema.Type): useItemDetailSources.Projection => {
	const game = useGameEngine();
	const selector = useCallback(
		(runtime: RuntimeSchema.Type): useItemDetailSources.Projection => {
			const projection = game.readOrThrow(
				readItemDetailSourcesFx({
					itemId,
					runtime,
				}),
			);
			if (projection.kind === "unavailable") return unavailable;
			const target = game.config.items[projection.targetDefinitionItemId];
			if (target === undefined) return unavailable;
			return {
				kind: "available",
				itemId: projection.itemId,
				targetTitle: target.title,
				source: projection.source.flatMap((source) => {
					const owner = runtime.items.find(
						(candidate) => candidate.id === source.ownerItemId,
					);
					const configured = game.config.items[source.ownerDefinitionItemId];
					if (owner === undefined || configured === undefined) return [];
					return [
						{
							ownerItemId: source.ownerItemId,
							title: configured.title,
							sourceUrl: game.getResourceUrl(
								readRuntimeItemPrimaryAssetId(runtime, owner.item),
							),
							...(configured.asset.composite === undefined
								? {}
								: {
										compositeUrl: game.getResourceUrl(
											configured.asset.composite,
										),
									}),
							space: source.space,
							line: source.line,
						} satisfies useItemDetailSources.Source,
					];
				}),
			};
		},
		[
			game,
			itemId,
		],
	);
	return useRuntimeSelector(selector, sameProjection);
};
