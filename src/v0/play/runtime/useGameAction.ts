import { useCallback, useState } from "react";
import type { GameAction } from "~/v0/game/action/GameActionSchema";
import { toGameActionError } from "~/v0/play/action/toGameActionError";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import { useGameRuntimeStore } from "~/v0/play/runtime/GameRuntimeContext";

export namespace useGameAction {
	export interface Result {
		error: unknown;
		isPending: boolean;
		run(action: GameAction | unknown): Promise<GameEngineResult>;
	}
}

export const useGameAction = (): useGameAction.Result => {
	const store = useGameRuntimeStore();
	const [isPending, setIsPending] = useState(false);
	const [error, setError] = useState<unknown>(undefined);

	const run = useCallback(
		async (action: GameAction | unknown) => {
			setIsPending(true);
			setError(undefined);
			try {
				return await store.dispatch({
					action,
					nowMs: Date.now(),
				});
			} catch (nextError) {
				const actionError = toGameActionError(nextError);
				setError(actionError);
				throw actionError;
			} finally {
				setIsPending(false);
			}
		},
		[
			store,
		],
	);

	return {
		error,
		isPending,
		run,
	};
};
