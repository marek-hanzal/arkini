import { readItemScheduleFn } from "~/item-schedule/fn/readItemScheduleFn";
import { resolveItemScheduleEnabledFx } from "~/item-schedule/fx/resolveItemScheduleEnabledFx";
import { Array, Effect, Result } from "effect";

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
import { resolveLineRunFx } from "~/production-line/fx/resolveLineRunFx";
import { readLineInputDeliveryClaimsFn } from "~/production-delivery/fn/readLineInputDeliveryClaimsFn";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

const readQueueBadgeCountFx = Effect.fn("readTileActorsFx.readQueueBadgeCountFx")(function* ({
	item,
	runtime,
}: {
	readonly item: RuntimeItemSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) {
	const jobs = runtime.jobs.filter((job) => job.ownerItemId === item.id);
	const requests = runtime.jobQueue.filter((request) => request.ownerItemId === item.id);
	let count = jobs.filter((job) => job.durationMs > 0).length;
	for (const [index, request] of requests.entries()) {
		// Only the immediately startable instant request is a one-frame x1 artifact.
		// A request waiting for inputs, delivery, or an earlier job remains real queue work.
		if (jobs.length > 0 || index > 0) {
			count += 1;
			continue;
		}
		const resolved = yield* Effect.result(
			resolveLineRunFx({
				ownerItemId: item.id,
				lineUid: request.lineUid,
				runtime,
			}),
		);
		if (Result.isFailure(resolved)) {
			count += 1;
			continue;
		}
		const run = resolved.success;
		if (
			run.runtimeMs > 0 ||
			!run.ready ||
			readLineInputDeliveryClaimsFn({
				ownerItemId: item.id,
				lineUid: request.lineUid,
				runtime,
			}).length > 0
		)
			count += 1;
	}
	return count > 0 ? count : undefined;
});

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
			const queueBadgeCount = yield* readQueueBadgeCountFx({
				item,
				runtime,
			});
			const totalUnits = item.item.units?.amount;
			const remainingUnits = readItemRemainingUnitsFn(item);
			const colorFraction =
				totalUnits === undefined
					? undefined
					: remainingUnits === 0 && activeJob !== undefined
						? 1
						: clampRatioFn((remainingUnits ?? totalUnits) / totalUnits);
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
