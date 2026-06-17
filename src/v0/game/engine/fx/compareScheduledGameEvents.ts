import type { GameSaveScheduledEvent } from "~/v0/game/engine/model/GameSaveSchema";

export namespace compareScheduledGameEvents {
	export interface Props {
		left: GameSaveScheduledEvent;
		right: GameSaveScheduledEvent;
	}
}

export const compareScheduledGameEvents = (
	left: GameSaveScheduledEvent,
	right: GameSaveScheduledEvent,
) => left.dueAtMs - right.dueAtMs || left.id.localeCompare(right.id);
