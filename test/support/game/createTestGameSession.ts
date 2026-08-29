import { Effect } from "effect";
import {
	createGameSessionFx,
	type createGameSessionFx as GameSessionFactory,
} from "~/renderer/game/session/createGameSessionFx";

export const createTestGameSession = <SaveError>(props: GameSessionFactory.Props<SaveError>) =>
	Effect.runPromise(createGameSessionFx(props));
