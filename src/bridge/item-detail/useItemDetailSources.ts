import { useCallback } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import { useRuntimeSelector } from "~/bridge/runtime/useRuntimeSelector";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { readItemDetailSourcesFx } from "~/engine/item-detail/read/readItemDetailSourcesFx";
import { readRuntimeItemPrimaryAssetIdFx } from "~/engine/item/read/readRuntimeItemPrimaryAssetIdFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace useItemDetailSources {
	export type Target =
		| {
				readonly kind: "runtime";
				readonly itemId: IdSchema.Type;
		  }
		| {
				readonly kind: "definition";
				readonly itemId: IdSchema.Type;
		  };

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

/** Projects exact owned Board sources that visibly produce one inspected runtime or definition item. */
export const useItemDetailSources = (
	target: useItemDetailSources.Target,
): useItemDetailSources.Projection => {
	const game = useGameEngine();
	const { itemId, kind } = target;
	const isEqual = useCallback(
		(left: useItemDetailSources.Projection, right: useItemDetailSources.Projection) => {
			if (left.kind !== right.kind) return false;
			if (left.kind === "unavailable" || right.kind === "unavailable") return true;
			const sameQuantity = (
				leftQuantity: readItemDetailSourcesFx.QuantityBounds,
				rightQuantity: readItemDetailSourcesFx.QuantityBounds,
			) => leftQuantity.min === rightQuantity.min && leftQuantity.max === rightQuantity.max;
			const sameOutputFact = (
				leftOutput: useItemDetailSources.OutputFact,
				rightOutput: useItemDetailSources.OutputFact,
			) => {
				if (
					leftOutput.kind !== rightOutput.kind ||
					!sameQuantity(leftOutput.quantity, rightOutput.quantity) ||
					leftOutput.setWeight !== rightOutput.setWeight ||
					leftOutput.totalSetWeight !== rightOutput.totalSetWeight
				) {
					return false;
				}
				if (leftOutput.kind === "guaranteed" || rightOutput.kind === "guaranteed") {
					return true;
				}
				if (leftOutput.kind === "chance" && rightOutput.kind === "chance") {
					return leftOutput.chance === rightOutput.chance;
				}
				return (
					leftOutput.kind === "weight" &&
					rightOutput.kind === "weight" &&
					leftOutput.optionWeight === rightOutput.optionWeight &&
					leftOutput.totalOptionWeight === rightOutput.totalOptionWeight &&
					sameQuantity(leftOutput.selections, rightOutput.selections)
				);
			};
			const sameLine = (
				leftLine: useItemDetailSources.Line,
				rightLine: useItemDetailSources.Line,
			) =>
				leftLine.lineId === rightLine.lineId &&
				leftLine.title === rightLine.title &&
				leftLine.output.length === rightLine.output.length &&
				leftLine.output.every(
					(output, index) =>
						rightLine.output[index] !== undefined &&
						sameOutputFact(output, rightLine.output[index]),
				);
			const sameSource = (
				leftSource: useItemDetailSources.Source,
				rightSource: useItemDetailSources.Source,
			) =>
				leftSource.ownerItemId === rightSource.ownerItemId &&
				leftSource.title === rightSource.title &&
				leftSource.sourceUrl === rightSource.sourceUrl &&
				leftSource.compositeUrl === rightSource.compositeUrl &&
				leftSource.space === rightSource.space &&
				leftSource.line.length === rightSource.line.length &&
				leftSource.line.every(
					(line, index) =>
						rightSource.line[index] !== undefined &&
						sameLine(line, rightSource.line[index]),
				);
			return (
				left.itemId === right.itemId &&
				left.targetTitle === right.targetTitle &&
				left.source.length === right.source.length &&
				left.source.every(
					(source, index) =>
						right.source[index] !== undefined &&
						sameSource(source, right.source[index]),
				)
			);
		},
		[],
	);
	const selector = useCallback(
		(runtime: RuntimeSchema.Type): useItemDetailSources.Projection => {
			const projection = game.readOrThrow(
				readItemDetailSourcesFx({
					target: {
						kind,
						itemId,
					},
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
								game.readOrThrow(
									readRuntimeItemPrimaryAssetIdFx({
										item: owner.item,
									}),
								),
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
			kind,
		],
	);
	return useRuntimeSelector(game, selector, isEqual);
};
