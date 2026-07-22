import { Effect } from "effect";

import type { GameEngine } from "~/bridge/game/GameEngine";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import { readRuntimeItemPrimaryAssetIdFx } from "~/engine/item/read/readRuntimeItemPrimaryAssetIdFx";
import { readRuntimeItemPrimaryAction } from "~/engine/item-detail/read/readRuntimeItemPrimaryAction";
import { resolveActiveJobStatusFx } from "~/engine/job/fx/resolveActiveJobStatusFx";
import { JobStatusEnumSchema } from "~/engine/job/schema/read/JobStatusEnumSchema";
import { isGridRuntimeItem } from "~/engine/runtime/read/isGridRuntimeItem";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace readTileActorsFx {
	export interface Props {
		readonly game: GameEngine;
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Projects every exact live grid identity needed by the shared Canvas actor layer. */
export const readTileActorsFx = Effect.fn("readTileActorsFx")(function* ({
	game,
	runtime,
}: readTileActorsFx.Props) {
	const activeJobs = new Map(runtime.jobs.map((job) => [job.ownerItemId, job]));

	return yield* Effect.forEach(runtime.items.filter(isGridRuntimeItem), (item) =>
		Effect.gen(function* () {
			const activeJob = activeJobs.get(item.id);
			const activeJobStatus =
				activeJob === undefined
					? undefined
					: yield* resolveActiveJobStatusFx({
							job: activeJob,
							runtime,
						});
			const primaryAssetId = yield* readRuntimeItemPrimaryAssetIdFx({
				item: item.item,
			});

			return {
				id: item.id,
				revision: item.revision,
				itemId: item.item.id,
				title: item.item.title,
				quantity: item.quantity,
				location: item.location,
				running: activeJobStatus === JobStatusEnumSchema.enum.Running,
				primaryAction: readRuntimeItemPrimaryAction({ item, runtime }),
				sourceUrl: game.getResourceUrl(primaryAssetId),
				...(item.item.asset.composite === undefined
					? {}
					: {
							compositeUrl: game.getResourceUrl(item.item.asset.composite),
						}),
			} satisfies TileActorItem;
		}),
	);
});
