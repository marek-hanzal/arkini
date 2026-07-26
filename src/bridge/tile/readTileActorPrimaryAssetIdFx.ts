import { Effect } from "effect";
import { match, P } from "ts-pattern";

import { readRuntimeItemPrimaryAssetIdFx } from "~/engine/item/read/readRuntimeItemPrimaryAssetIdFx";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";
import { readRuntimeLineFillProgressFx } from "~/engine/line/read/readRuntimeLineFillProgressFx";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace readTileActorPrimaryAssetIdFx {
	export interface Props {
		readonly item: RuntimeItemSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}
}

/**
 * Selects the authored tile face for one committed runtime item.
 *
 * Craft and blueprint source assets are evenly distributed from an empty to a
 * completely filled material line. Other item kinds keep their canonical first
 * source until they gain an explicit progress contract.
 */
export const readTileActorPrimaryAssetIdFx = Effect.fn("readTileActorPrimaryAssetIdFx")(function* ({
	item,
	runtime,
}: readTileActorPrimaryAssetIdFx.Props) {
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
					ItemEnumSchema.enum.Stash,
					ItemEnumSchema.enum.Temporary,
				),
			},
			() => null,
		)
		.exhaustive();
	const primaryAssetId = yield* readRuntimeItemPrimaryAssetIdFx({
		item: item.item,
	});
	if (progressLine === null || item.item.asset.source.length === 1) {
		return primaryAssetId;
	}

	const progress = yield* readRuntimeLineFillProgressFx({
		line: progressLine,
		ownerItemId: item.id,
		runtime,
	});
	const sourceIndex = Math.min(
		item.item.asset.source.length - 1,
		Math.floor(progress * (item.item.asset.source.length - 1)),
	);

	return item.item.asset.source[sourceIndex] ?? primaryAssetId;
});
