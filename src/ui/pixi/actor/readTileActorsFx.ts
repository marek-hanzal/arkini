import { Array, Effect } from "effect";
import { match, P } from "ts-pattern";

import type { GameEngine } from "~/renderer/game/GameEngine";
import type { JobSchema } from "~/production-job/schema/JobSchema";
import { TypeSchema } from "~/item-definition/schema/TypeSchema";
import type { TileActorItem } from "~/ui/pixi/actor/TileActorItem";
import { readTileActorBadgeCountFn } from "~/ui/pixi/actor/fn/readTileActorBadgeCountFn";
import { readTileActorAssetSourceIdsFx } from "~/ui/pixi/actor/readTileActorAssetSourceIdsFx";
import { readTileActorVisualFx } from "~/ui/pixi/actor/readTileActorVisualFx";
import { readRuntimeItemPrimaryActionFx } from "~/item-interaction/read/readRuntimeItemPrimaryActionFx";
import { resolveActiveJobStatusFx } from "~/production-job/fx/resolveActiveJobStatusFx";
import { JobStatusEnumSchema } from "~/production-job/schema/read/JobStatusEnumSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { isGridRuntimeItemFn } from "~/game-runtime/read/fn/isGridRuntimeItemFn";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace readTileActorsFx {
	export interface Props {
		readonly game: GameEngine;
		readonly runtime: RuntimeSchema.Type;
		readonly surface: "inventory" | "main";
	}
}

const readQueueBadgeCountFn = ({
	ownerItemId,
	runtime,
}: {
	readonly ownerItemId: string;
	readonly runtime: RuntimeSchema.Type;
}) => {
	const count =
		runtime.jobs.filter((job) => job.ownerItemId === ownerItemId).length +
		runtime.jobQueue.filter((request) => request.ownerItemId === ownerItemId).length;
	return count > 0 ? count : undefined;
};

const readActivityEffectFn = ({
	itemType,
	running,
}: {
	readonly itemType: TypeSchema.Type;
	readonly running: boolean;
}) =>
	match(itemType)
		.with(
			P.union(
				TypeSchema.enum.Blueprint,
				TypeSchema.enum.Craft,
				TypeSchema.enum.Deposit,
				TypeSchema.enum.Producer,
			),
			() => running,
		)
		.with(
			P.union(
				TypeSchema.enum.Inventory,
				TypeSchema.enum.Simple,
				TypeSchema.enum.Space,
				TypeSchema.enum.Stash,
				TypeSchema.enum.Temporary,
			),
			() => false,
		)
		.exhaustive();

const clampRatioFn = (ratio: number) => Math.max(0, Math.min(1, ratio));

const readProgressRatioFn = ({
	activeJob,
	item,
}: {
	readonly activeJob?: JobSchema.Type;
	readonly item: RuntimeItemSchema.Type;
}) =>
	match({
		activeJob,
		item,
	})
		.with(
			{
				activeJob: P.nonNullable,
			},
			({ activeJob: job }) =>
				job.durationMs <= 0 ? 1 : clampRatioFn(1 - job.remainingMs / job.durationMs),
		)
		.with(
			{
				activeJob: P.nullish,
				item: {
					item: {
						type: TypeSchema.enum.Temporary,
					},
				},
			},
			({ item: temporary }) =>
				temporary.item.durationMs <= 0
					? 0
					: clampRatioFn(
							(temporary.remainingDurationMs ?? temporary.item.durationMs) /
								temporary.item.durationMs,
						),
		)
		.otherwise(() => undefined);

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
			const queueBadgeCount = readQueueBadgeCountFn({
				ownerItemId: item.id,
				runtime,
			});
			const badgeCount =
				queueBadgeCount === undefined ? readTileActorBadgeCountFn(item) : queueBadgeCount;
			const progressRatio = readProgressRatioFn({
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
				activityEffect: readActivityEffectFn({
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
