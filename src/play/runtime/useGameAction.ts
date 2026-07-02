import { useCallback, useState } from "react";
import type { GameAction } from "~/action/GameActionSchema";
import { toGameActionError } from "~/play/action/toGameActionError";
import type { GameEngineResult } from "~/engine/model/GameEngineResult";
import { useGameRuntimeStore } from "~/play/runtime/GameRuntimeContext";

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
