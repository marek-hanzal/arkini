import { useCallback, useMemo } from "react";

import type { PlayableGame } from "~/renderer/game/PlayableGame";
import { useGameEngine } from "~/ui/game/useGameEngine";
import type {
	ItemDetailPendingAction,
	ItemDetailPendingActionOwner,
} from "~/item-detail-frame/ItemDetailControl";

interface UseItemDetailPendingCommandOptions<Props, Result, Failure> {
	readonly action: ItemDetailPendingAction;
	readonly failureMessage: string;
	readonly pendingKey: string;
	readonly pendingOwner: ItemDetailPendingActionOwner;
	readonly run: (
		game: PlayableGame,
		props: Props,
	) => import("effect").Effect.Effect<Result, Failure>;
}

/** Projects one exact command key from the provider-scoped Item Detail authority. */
export const useItemDetailPendingCommand = <Props, Result, Failure>({
	action,
	failureMessage,
	pendingKey,
	pendingOwner,
	run: runCommand,
}: UseItemDetailPendingCommandOptions<Props, Result, Failure>) => {
	const game = useGameEngine();
	const run = useCallback(
		(command: Props) =>
			pendingOwner.runPendingAction({
				key: pendingKey,
				action,
				failureMessage,
				run: runCommand(game, command),
			}),
		[
			action,
			failureMessage,
			game,
			pendingKey,
			pendingOwner,
			runCommand,
		],
	);

	return useMemo(
		() => ({
			error: pendingOwner.readActionError(pendingKey),
			pending: pendingOwner.readPendingAction(pendingKey) === action,
			run,
		}),
		[
			action,
			pendingKey,
			pendingOwner,
			run,
		],
	);
};
