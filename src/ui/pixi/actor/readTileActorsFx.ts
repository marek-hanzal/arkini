import { Array, Effect } from "effect";

import type { GameEngine } from "~/renderer/game/GameEngine";
import type { TileActorItem } from "~/ui/pixi/actor/TileActorItem";
import { readTileActorBadgeCountFn } from "~/ui/pixi/actor/fn/readTileActorBadgeCountFn";
import { readTileActorAssetSourceIdsFx } from "~/ui/pixi/actor/readTileActorAssetSourceIdsFx";
import { readTileActorProgressRatioFn } from "~/ui/pixi/actor/fn/readTileActorProgressRatioFn";
import { readTileActorQueueBadgeCountFn } from "~/ui/pixi/actor/fn/readTileActorQueueBadgeCountFn";
import { readTileActorVisualFx } from "~/ui/pixi/actor/readTileActorVisualFx";
import { readTileActorActivityEffectFn } from "~/ui/pixi/actor/fn/readTileActorActivityEffectFn";
import { readRuntimeItemPrimaryActionFx } from "~/engine/item-detail/read/readRuntimeItemPrimaryActionFx";
import { resolveActiveJobStatusFx } from "~/engine/job/fx/resolveActiveJobStatusFx";
import { JobStatusEnumSchema } from "~/engine/job/schema/read/JobStatusEnumSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { isGridRuntimeItemFn } from "~/engine/runtime/read/fn/isGridRuntimeItemFn";
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
	const gridItems = Array.getSomes(runtime.items.map(isGridRuntimeItemFn)).filter((item) =>
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
				sourceIds: yield* readTileActorAssetSourceIdsFx({
					item,
					runtime,
				}),
			});
			const running = activeJobStatus === JobStatusEnumSchema.enum.Running;
			const queueBadgeCount = readTileActorQueueBadgeCountFn({
				ownerItemId: item.id,
				runtime,
			});
			const badgeCount =
				queueBadgeCount === undefined ? readTileActorBadgeCountFn(item) : queueBadgeCount;
			const progressRatio = readTileActorProgressRatioFn({
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
				activityEffect: readTileActorActivityEffectFn({
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
