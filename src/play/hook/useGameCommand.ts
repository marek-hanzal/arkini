import { useMutation } from "@tanstack/react-query";
import type { GameCommand, GameCommandResult } from "~/action/GameCommand";
import { gameCommandInvalidation } from "~/action/gameCommandInvalidation";
import { runGameCommand } from "~/action/runGameCommand";
import { usePlayDataInvalidation } from "./usePlayDataInvalidation";

export namespace useGameCommand {
	export interface Options {
		invalidateOnSuccess?: boolean;
	}
}

export function useGameCommand<Command extends GameCommand = GameCommand>(
	options: useGameCommand.Options = {},
) {
	const invalidatePlayData = usePlayDataInvalidation();

	return useMutation({
		async mutationFn(command: Command): Promise<GameCommandResult<Command>> {
			return runGameCommand({
				command,
			});
		},
		async onSuccess(_result, command) {
			if (options.invalidateOnSuccess === false) return;
			await invalidatePlayData(
				gameCommandInvalidation({
					command,
				}),
			);
		},
	});
}
