import type { PlayableGame } from "~/playable-game/type/PlayableGame";
import { useGameEngine } from "~/game-presentation/ui/useGameEngine";
import type { ItemDetailPendingAction } from "~/item-detail-frame/type/ItemDetailControl";
import { useItemDetailControl } from "~/item-detail-frame/ui/useItemDetailControl";

interface UseItemDetailPendingCommandOptions<Props, Result, Failure> {
	readonly action: ItemDetailPendingAction;
	readonly failureMessage: string;
	readonly pendingKey: string;
	readonly runFx: (
		game: PlayableGame,
		props: Props,
	) => import("effect").Effect.Effect<Result, Failure>;
}

/** Projects one exact command key from the provider-scoped Item Detail authority. */
export const useItemDetailPendingCommand = <Props, Result, Failure>({
	action,
	failureMessage,
	pendingKey,
	runFx: runCommandFx,
}: UseItemDetailPendingCommandOptions<Props, Result, Failure>) => {
	const game = useGameEngine();
	const itemDetail = useItemDetailControl();

	return {
		error: itemDetail.readActionErrorFn(pendingKey),
		pending: itemDetail.readPendingActionFn(pendingKey) === action,
		runFn: (command: Props) =>
			itemDetail.runPendingActionFn({
				key: pendingKey,
				action,
				failureMessage,
				run: runCommandFx(game, command),
			}),
	};
};
