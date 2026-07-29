import { Array, Effect } from "effect";

import type { GameEngine } from "~/bridge/game/GameEngine";
import type { TileActorItem } from "~/bridge/tile/TileActorItem";
import { readTileActorBadgeCountFx } from "~/bridge/tile/readTileActorBadgeCountFx";
import { readTileActorPrimaryAssetIdFx } from "~/bridge/tile/readTileActorPrimaryAssetIdFx";
import { readTileActorProgressRatioFx } from "~/bridge/tile/readTileActorProgressRatioFx";
import { readTileActorQueueBadgeCount } from "~/bridge/tile/readTileActorQueueBadgeCount";
import { readTileActorVisualFx } from "~/bridge/tile/readTileActorVisualFx";
import { readTileActorActivityEffectFx } from "~/bridge/tile/readTileActorActivityEffectFx";
import { readRuntimeItemPrimaryActionFx } from "~/engine/item-detail/read/readRuntimeItemPrimaryActionFx";
import { resolveActiveJobStatusFx } from "~/engine/job/fx/resolveActiveJobStatusFx";
import { JobStatusEnumSchema } from "~/engine/job/schema/read/JobStatusEnumSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { isGridRuntimeItemFx } from "~/engine/runtime/read/isGridRuntimeItemFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace readTileActorsFx {
	export interface Props {
		readonly game: GameEngine;
		readonly runtime: RuntimeSchema.Type;
		readonly surface: "inventory" | "main";
	}
}

/** Projects only exact live grid identities visible to one Pixi scene. */
export const readTileActorsFx = Effect.fnUntraced(function* ({
	game,
	runtime,
	surface,
}: readTileActorsFx.Props) {
	const activeJobs = new Map(
		runtime.jobs.map((job) => [
			job.ownerItemId,
			job,
		]),
	);
	const gridItems = Array.getSomes(
		yield* Effect.forEach(runtime.items, isGridRuntimeItemFx),
	).filter((item) =>
		surface === "inventory"
			? item.location.scope === LocationScopeEnumSchema.enum.Inventory
			: item.location.scope === LocationScopeEnumSchema.enum.Toolbar ||
				(item.location.scope === LocationScopeEnumSchema.enum.Board &&
					item.location.space === runtime.currentSpace),
	);

	return yield* Effect.forEach(gridItems, (item) =>
		Effect.gen(function* () {
			const activeJob = activeJobs.get(item.id);
			const activeJobStatus =
				activeJob === undefined
					? undefined
					: yield* resolveActiveJobStatusFx({
							job: activeJob,
							runtime,
						});
			const visual = yield* readTileActorVisualFx({
				game,
				item: item.item,
				primaryAssetId: yield* readTileActorPrimaryAssetIdFx({
					item,
					runtime,
				}),
			});
			const running = activeJobStatus === JobStatusEnumSchema.enum.Running;
			const queueBadgeCount = readTileActorQueueBadgeCount({
				ownerItemId: item.id,
				runtime,
			});
			const badgeCount =
				queueBadgeCount === undefined
					? yield* readTileActorBadgeCountFx(item)
					: queueBadgeCount;
			const progressRatio = yield* readTileActorProgressRatioFx({
				activeJob,
				item,
			});

			return {
				...visual,
				...(badgeCount === undefined
					? {}
					: {
							badgeCount,
						}),
				...(queueBadgeCount === undefined
					? {}
					: {
							badgeKind: "queue" as const,
						}),
				id: item.id,
				itemType: item.item.type,
				revision: item.revision,
				quantity: item.quantity,
				location: item.location,
				...(activeJobStatus === undefined
					? {}
					: {
							jobStatus: activeJobStatus,
						}),
				running,
				...(progressRatio === undefined
					? {}
					: {
							progressRatio,
						}),
				activityEffect: yield* readTileActorActivityEffectFx({
					itemType: item.item.type,
					running,
				}),
				primaryAction: yield* readRuntimeItemPrimaryActionFx({
					item,
					runtime,
				}),
			} satisfies TileActorItem;
		}),
	);
});
