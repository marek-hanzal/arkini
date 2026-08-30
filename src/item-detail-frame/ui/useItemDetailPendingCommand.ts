import { useCallback, useMemo } from "react";

import type { PlayableGame } from "~/renderer/game/PlayableGame";
import { useGameEngine } from "~/game-presentation/ui/useGameEngine";
import type { ItemDetailPendingAction } from "~/item-detail-frame/type/ItemDetailControl";
import { useItemDetailControl } from "~/item-detail-frame/ui/useItemDetailControl";

interface UseItemDetailPendingCommandOptions<Props, Result, Failure> {
	readonly action: ItemDetailPendingAction;
	readonly failureMessage: string;
	readonly pendingKey: string;
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
	run: runCommand,
}: UseItemDetailPendingCommandOptions<Props, Result, Failure>) => {
	const game = useGameEngine();
	const itemDetail = useItemDetailControl();
	const run = useCallback(
		(command: Props) =>
			itemDetail.runPendingAction({
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
			itemDetail,
			runCommand,
		],
	);

	return useMemo(
		() => ({
			error: itemDetail.readActionError(pendingKey),
			pending: itemDetail.readPendingAction(pendingKey) === action,
			run,
		}),
		[
			action,
			pendingKey,
			itemDetail,
			run,
		],
	);
};
