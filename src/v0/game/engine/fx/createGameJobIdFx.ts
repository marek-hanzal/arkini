import { Effect } from "effect";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace createGameJobIdFx {
	export interface Props {
		save: GameSave;
	}
}

export const createGameJobIdFx = Effect.fn("createGameJobIdFx")(function* ({
	save,
}: createGameJobIdFx.Props) {
	const id = `job:${save.nextJobIndex}`;
	save.nextJobIndex += 1;
	return id;
});
