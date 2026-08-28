import { Effect } from "effect";
import { match, P } from "ts-pattern";

import { readRuntimeItemDefaultAssetIdsFx } from "~/engine/item/read/readRuntimeItemDefaultAssetIdsFx";
import type { AssetSchema } from "~/engine/item/schema/AssetSchema";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";
import { readRuntimeLineFillProgressFx } from "~/engine/line/read/readRuntimeLineFillProgressFx";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace readTileActorAssetSourceIdsFx {
	export interface Props {
		readonly item: RuntimeItemSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}
}

/**
 * Selects the complete authored tile composition for one committed runtime item.
 *
 * Craft and blueprint progress states are evenly distributed after the default
 * composition. Other item kinds keep their default until the engine gives them
 * an explicit progress projection.
 */
export const readTileActorAssetSourceIdsFx = Effect.fn("readTileActorAssetSourceIdsFx")(function* ({
	item,
	runtime,
}: readTileActorAssetSourceIdsFx.Props) {
	const progressLine = match(item.item)
		.with(
			{
				type: P.union(ItemEnumSchema.enum.Blueprint, ItemEnumSchema.enum.Craft),
			},
			({ line }) => line,
		)
		.with(
			{
				type: P.union(
					ItemEnumSchema.enum.Deposit,
					ItemEnumSchema.enum.Inventory,
					ItemEnumSchema.enum.Producer,
					ItemEnumSchema.enum.Simple,
					ItemEnumSchema.enum.Space,
					ItemEnumSchema.enum.Stash,
					ItemEnumSchema.enum.Temporary,
				),
			},
			() => null,
		)
		.exhaustive();
	const defaultAssetIds = yield* readRuntimeItemDefaultAssetIdsFx({
		item: item.item,
	});
	if (progressLine === null || item.item.asset.sources === undefined) {
		return defaultAssetIds;
	}

	const progress = yield* readRuntimeLineFillProgressFx({
		line: progressLine,
		ownerItemId: item.id,
		runtime,
	});
	const stateIndex = Math.min(
		item.item.asset.sources.length,
		Math.floor(progress * item.item.asset.sources.length),
	);
	if (stateIndex === 0) return defaultAssetIds;
	const source = item.item.asset.sources[stateIndex - 1];
	return (
		source === undefined
			? defaultAssetIds
			: [
					source,
				]
	) satisfies AssetSchema.Type["default"];
});
