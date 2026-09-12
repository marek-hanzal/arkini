import { match, P } from "ts-pattern";

import type { AssetSchema } from "~/item-definition/schema/AssetSchema";
import { TypeSchema } from "~/item-definition/schema/TypeSchema";
import { readRuntimeLineFillProgressFn } from "~/production-line/fn/readRuntimeLineFillProgressFn";
import { readProgressArtworkThresholdsFn } from "~/tile-presentation/fn/readProgressArtworkThresholdsFn";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

/**
 * Selects the complete authored tile composition for one committed runtime item.
 *
 * Craft and blueprint states follow their input-fill progress. Temporary items
 * distribute the default composition and every progress state evenly across
 * their lifetime. Other item kinds keep their authored default composition.
 */
export const readTileActorAssetSourceIdsFn = ({
	item,
	runtime,
}: {
	readonly item: RuntimeItemSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) => {
	const progress = match(item.item)
		.with(
			{
				type: P.union(TypeSchema.enum.Blueprint, TypeSchema.enum.Craft),
			},
			({ line }) =>
				readRuntimeLineFillProgressFn({
					line,
					ownerItemId: item.id,
					runtime,
				}),
		)
		.with(
			{
				type: TypeSchema.enum.Temporary,
			},
			({ durationMs }) => 1 - (item.remainingDurationMs ?? durationMs) / durationMs,
		)
		.with(
			{
				type: P.union(
					TypeSchema.enum.Inventory,
					TypeSchema.enum.Producer,
					TypeSchema.enum.Clock,
					TypeSchema.enum.Simple,
					TypeSchema.enum.Space,
					TypeSchema.enum.Stash,
				),
			},
			() => null,
		)
		.exhaustive();
	const defaultAssetIds = item.item.asset.default;
	if (progress === null || item.item.asset.sources === undefined) {
		return defaultAssetIds;
	}

	const thresholds = readProgressArtworkThresholdsFn({
		itemType: item.item.type,
		sourceCount: item.item.asset.sources.length,
	});
	const stateIndex = thresholds.filter((threshold) => progress >= threshold).length;
	if (stateIndex === 0) return defaultAssetIds;
	const source = item.item.asset.sources[stateIndex - 1];
	return (
		source === undefined
			? defaultAssetIds
			: [
					source,
				]
	) satisfies AssetSchema.Type["default"];
};
