import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { cloneGameSaveFx } from "~/v0/game/save/cloneGameSaveFx";
import { processItemSpawnJobFx } from "~/v0/game/job/processItemSpawnJobFx";
import { readDueItemSpawnJobsFx } from "~/v0/game/job/readDueItemSpawnJobsFx";
import { isItemSpawnJobWaitingForDependencies } from "~/v0/game/world/isItemSpawnJobWaitingForDependencies";
import type { GameEvent } from "~/v0/game/event/GameEventSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export const blockedItemSpawnJobRetryDelayMs = 1000;

export namespace processItemSpawnJobsFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		nowMs: number;
	}
}

export const processItemSpawnJobsFx = Effect.fn("processItemSpawnJobsFx")(function* ({
	config,
	save,
	nowMs,
}: processItemSpawnJobsFx.Props) {
	const dueJobs = yield* readDueItemSpawnJobsFx({
		nowMs,
		save,
	});

	if (dueJobs.length === 0) {
		return {
			events: [],
			save,
		};
	}

	let nextSave = yield* cloneGameSaveFx({
		save,
	});
	const events: GameEvent[] = [];
	const processedExclusiveGroupKeys = new Set<string>();

	for (const itemSpawnJob of dueJobs) {
		if (
			itemSpawnJob.exclusiveGroupKey &&
			processedExclusiveGroupKeys.has(itemSpawnJob.exclusiveGroupKey)
		) {
			continue;
		}
		if (
			isItemSpawnJobWaitingForDependencies({
				job: itemSpawnJob,
				save: nextSave,
			})
		) {
			continue;
		}

		const result = yield* processItemSpawnJobFx({
			config,
			nowMs,
			save: nextSave,
			itemSpawnJob,
		});

		if (itemSpawnJob.exclusiveGroupKey) {
			processedExclusiveGroupKeys.add(itemSpawnJob.exclusiveGroupKey);
		}

		if (result.type === "blocked") {
			const alreadyBlocked = itemSpawnJob.lastBlockedAtMs !== undefined;
			nextSave.itemSpawnJobs[itemSpawnJob.id] = {
				...itemSpawnJob,
				readyAtMs: nowMs + blockedItemSpawnJobRetryDelayMs,
				lastBlockedAtMs: nowMs,
			};
			nextSave.updatedAtMs = nowMs;
			if (!alreadyBlocked) {
				events.push(...result.events);
			}
			continue;
		}

		nextSave = result.save;
		events.push(...result.events);
	}

	return {
		events,
		save: nextSave,
	};
});
