import { Effect } from "effect";
import { completeCraftJobFx } from "~/v0/game/craft/completeCraftJobFx";
import { readCompletedCraftJobsFx } from "~/v0/game/craft/readCompletedCraftJobsFx";
import { syncRealtimeCraftJobsFx } from "~/v0/game/craft/syncRealtimeCraftJobsFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameEvent } from "~/v0/game/event/GameEventSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace processCompletedCraftJobsFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		nowMs: number;
	}
}

export const processCompletedCraftJobsFx = Effect.fn("processCompletedCraftJobsFx")(function* ({
	config,
	save,
	nowMs,
}: processCompletedCraftJobsFx.Props) {
	let nextSave = save;
	const events: GameEvent[] = [];

	while (true) {
		nextSave = yield* syncRealtimeCraftJobsFx({
			config,
			nowMs,
			save: nextSave,
		});
		const [job] = yield* readCompletedCraftJobsFx({
			nowMs,
			save: nextSave,
		});

		if (!job) {
			return {
				events,
				save: nextSave,
			};
		}

		const result = yield* completeCraftJobFx({
			config,
			job,
			nowMs,
			save: nextSave,
		});

		nextSave = result.save;
		events.push(...result.events);
	}
});
