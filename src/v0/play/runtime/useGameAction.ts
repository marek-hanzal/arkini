import { useCallback, useRef, useState } from "react";
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
	const pendingRunsRef = useRef(0);
	const [isPending, setIsPending] = useState(false);
	const [error, setError] = useState<unknown>(undefined);

	const run = useCallback(
		async (action: GameAction | unknown) => {
			pendingRunsRef.current += 1;
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
				pendingRunsRef.current = Math.max(0, pendingRunsRef.current - 1);
				setIsPending(pendingRunsRef.current > 0);
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
