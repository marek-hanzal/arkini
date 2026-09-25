import { readItemScheduleFn } from "~/item-schedule/fn/readItemScheduleFn";
import { resolveItemScheduleEnabledFx } from "~/item-schedule/fx/resolveItemScheduleEnabledFx";
import { Array, Effect } from "effect";

import type { GameEngine } from "~/playable-game/type/GameEngine";
import type { JobSchema } from "~/production-job/schema/JobSchema";
import type { TileActorItem } from "~/tile-presentation/type/TileActorItem";
import { readItemRemainingUnitsFn } from "~/production-action/fn/readItemRemainingUnitsFn";
import { readTileActorVisualFx } from "~/tile-presentation/fx/readTileActorVisualFx";
import { readRuntimeItemPrimaryActionFx } from "~/item-interaction/fx/readRuntimeItemPrimaryActionFx";
import { resolveActiveJobStatusFx } from "~/production-job/fx/resolveActiveJobStatusFx";
import { JobStatusEnumSchema } from "~/production-job/schema/JobStatusEnumSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { narrowBoardRuntimeItemFn } from "~/game-runtime/fn/narrowBoardRuntimeItemFn";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

const readQueueBadgeCountFn = ({
	ownerItemId,
	runtime,
}: {
	readonly ownerItemId: string;
	readonly runtime: RuntimeSchema.Type;
}) => {
	const count =
		runtime.jobs.filter((job) => job.ownerItemId === ownerItemId && job.durationMs > 0).length +
		runtime.jobQueue.filter((request) => request.ownerItemId === ownerItemId).length;
	return count > 0 ? count : undefined;
};

const clampRatioFn = (ratio: number) => Math.max(0, Math.min(1, ratio));

const readProgressRatioFn = ({
	activeJob,
	item,
}: {
	readonly activeJob?: JobSchema.Type;
	readonly item: RuntimeItemSchema.Type;
}) => {
	if (activeJob !== undefined && activeJob.durationMs > 0)
		return clampRatioFn(1 - activeJob.remainingMs / activeJob.durationMs);
	const durationMs = readItemScheduleFn(item.item)?.durationMs;
	if (durationMs === undefined) return undefined;
	return durationMs <= 0
		? 0
		: clampRatioFn((item.schedule?.remainingDurationMs ?? durationMs) / durationMs);
};

/** Projects only exact live grid identities visible to one Pixi scene. */
export const readTileActorsFx = Effect.fnUntraced(function* ({
	game,
	runtime,
}: {
	readonly game: Pick<GameEngine, "getResourceUrlFn">;
	readonly runtime: RuntimeSchema.Type;
}) {
	const activeJobs = new Map(
		runtime.jobs.map((job) => [
			job.ownerItemId,
			job,
		]),
	);
	const gridItems = Array.getSomes(runtime.items.map(narrowBoardRuntimeItemFn)).filter(
		(item) => item.location.space === runtime.currentSpace,
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
			});
			const running = activeJobStatus === JobStatusEnumSchema.enum.Running;
			const queueBadgeCount = readQueueBadgeCountFn({
				ownerItemId: item.id,
				runtime,
			});
			const totalUnits = item.item.units?.amount;
			const colorFraction =
				totalUnits === undefined
					? undefined
					: clampRatioFn((readItemRemainingUnitsFn(item) ?? totalUnits) / totalUnits);
			const progressRatio = readProgressRatioFn({
				activeJob,
				item,
			});
			const intervalMs = readItemScheduleFn(item.item)?.intervalMs;
			const clockPulse =
				item.location.scope !== LocationScopeEnumSchema.enum.Board ||
				intervalMs === undefined ||
				item.schedule?.remainingDurationMs === 0
					? undefined
					: {
							intervalMs,
							remainingMs: item.schedule?.remainingIntervalMs ?? intervalMs,
							enabled: yield* resolveItemScheduleEnabledFx({
								item,
								runtime,
							}),
						};

			return {
				...visual,
				...(queueBadgeCount === undefined
					? {}
					: {
							badgeCount: queueBadgeCount,
						}),
				...(colorFraction === undefined
					? {}
					: {
							colorFraction,
						}),
				id: item.id,
				revision: item.revision,
				location: item.location,
				running: running && activeJob !== undefined && activeJob.durationMs > 0,
				...(clockPulse === undefined
					? {}
					: {
							clockPulse,
						}),
				...(progressRatio === undefined
					? {}
					: {
							progressRatio,
						}),
				primaryAction: yield* readRuntimeItemPrimaryActionFx({
					item,
					runtime,
				}),
			} satisfies TileActorItem;
		}),
	);
});
