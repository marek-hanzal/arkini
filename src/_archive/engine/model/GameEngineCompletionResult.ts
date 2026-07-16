import type { GameEvent } from "~/event/GameEventSchema";
import type { GameSave } from "~/engine/model/GameSaveSchema";

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
