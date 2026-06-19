import type { GameEvent } from "~/v0/game/event/GameEventSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export type GameEngineCompletionResult =
	| {
			type: "completed";
			save: GameSave;
			events: GameEvent[];
	  }
	| {
			type: "blocked";
			save: GameSave;
			events: GameEvent[];
	  };
