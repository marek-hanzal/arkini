import { Effect } from "effect";
import {
	createGameSessionFx,
	type createGameSessionFx as GameSessionFactory,
} from "~/game-session/fx/createGameSessionFx";

export const createTestGameSession = <SaveError>(props: GameSessionFactory.Props<SaveError>) =>
	Effect.runPromise(createGameSessionFx(props));
