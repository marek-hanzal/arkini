import { useAtom } from "@effect/atom-react";
import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { useMemo } from "react";

import type { Game } from "~/bridge/game/Game";
import { useGameEngine } from "~/bridge/game/useGameEngine";
import type {
	ItemDetailPendingAction,
	ItemDetailPendingActionOwner,
} from "~/bridge/item-detail/ItemDetailPendingActionOwner";

export namespace useItemDetailPendingCommand {
	export interface Options<Props, Result, Failure> {
		readonly action: ItemDetailPendingAction;
		readonly failureMessage: string;
		readonly pendingKey: string;
		readonly pendingOwner: ItemDetailPendingActionOwner;
		readonly run: (game: Game, props: Props) => Effect.Effect<Result, Failure>;
	}
}

/** Builds one concurrent Item Detail command with shared settlement ownership. */
export const useItemDetailPendingCommand = <Props, Result, Failure>({
	action,
	failureMessage,
	pendingKey,
	pendingOwner,
	run: runCommand,
}: useItemDetailPendingCommand.Options<Props, Result, Failure>) => {
	const game = useGameEngine();
	const runPendingActionFx = pendingOwner.runPendingActionFx;
	const commandAtom = useMemo(
		() =>
			Atom.fn(
				(command: Props) =>
					Effect.yieldNow.pipe(
						Effect.andThen(
							runPendingActionFx({
								key: pendingKey,
								action,
								failureMessage,
								run: runCommand(game, command),
							}),
						),
					),
				{
					concurrent: true,
				},
			).pipe(Atom.setIdleTTL(0)),
		[
			action,
			failureMessage,
			game,
			pendingKey,
			runCommand,
			runPendingActionFx,
		],
	);
	const [result, run] = useAtom(commandAtom);
	return useMemo(
		() => ({
			result,
			run,
		}),
		[
			result,
			run,
		],
	);
};
