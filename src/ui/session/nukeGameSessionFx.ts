import { Effect } from "effect";

import type { GameSession } from "~/ui/session/GameSession";

export namespace nukeGameSessionFx {
	export interface Props<DeleteError, CreateError> {
		session: GameSession;
		deletePersistedState: Effect.Effect<void, DeleteError>;
		createFreshSession: Effect.Effect<GameSession, CreateError>;
	}
}

/** Disposes one live session without saving, deletes persisted state, then creates a fresh session. */
export const nukeGameSessionFx = <DeleteError, CreateError>({
	session,
	deletePersistedState,
	createFreshSession,
}: nukeGameSessionFx.Props<DeleteError, CreateError>) =>
	Effect.tryPromise({
		try: () => session.disposeWithoutSave(),
		catch: (cause) => cause,
	}).pipe(Effect.zipRight(deletePersistedState), Effect.zipRight(createFreshSession));
