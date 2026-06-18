import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { processScheduledItemSpawnFx } from "~/v0/game/engine/fx/processScheduledItemSpawnFx";
import type { GameSave, GameSaveScheduledEvent } from "~/v0/game/engine/model/GameSaveSchema";

export namespace processScheduledGameEventFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
		scheduledEvent: GameSaveScheduledEvent;
		nowMs: number;
	}
}

export const processScheduledGameEventFx = ({
	config,
	save,
	scheduledEvent,
	nowMs,
}: processScheduledGameEventFx.Props) =>
	processScheduledItemSpawnFx({
		config,
		nowMs,
		save,
		scheduledEvent,
	});
