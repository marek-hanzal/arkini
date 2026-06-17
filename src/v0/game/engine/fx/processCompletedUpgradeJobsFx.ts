import { Effect } from "effect";
import { completeUpgradeJobFx } from "~/v0/game/engine/fx/completeUpgradeJobFx";
import { readCompletedUpgradeJobsFx } from "~/v0/game/engine/fx/readCompletedUpgradeJobsFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameEvent } from "~/v0/game/engine/model/GameEventSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace processCompletedUpgradeJobsFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		nowMs: number;
	}
}

export const processCompletedUpgradeJobsFx = Effect.fn("processCompletedUpgradeJobsFx")(function* ({
	config,
	save,
	nowMs,
}: processCompletedUpgradeJobsFx.Props) {
	let nextSave = save;
	const events: GameEvent[] = [];
	const upgradeJobs = yield* readCompletedUpgradeJobsFx({
		nowMs,
		save: nextSave,
	});

	for (const job of upgradeJobs) {
		const result = yield* completeUpgradeJobFx({
			config,
			job,
			nowMs,
			save: nextSave,
		});
		nextSave = result.save;
		events.push(...result.events);
	}

	return {
		events,
		save: nextSave,
	};
});
