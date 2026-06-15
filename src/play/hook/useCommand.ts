import { useMutation } from "@tanstack/react-query";
import type { Command } from "~/command/Command";
import type { CommandResult } from "~/command/CommandResult";
import { commandInvalidation } from "~/command/commandInvalidation";
import { runCommand } from "~/command/runCommand";
import { usePlayDataInvalidation } from "./usePlayDataInvalidation";

export namespace useCommand {
	export interface Options {
		invalidateOnSuccess?: boolean;
	}
}

export function useCommand<TCommand extends Command = Command>(options: useCommand.Options = {}) {
	const invalidatePlayData = usePlayDataInvalidation();

	return useMutation({
		async mutationFn(command: TCommand): Promise<CommandResult<TCommand>> {
			return runCommand({
				command,
			});
		},
		async onSuccess(_result, command) {
			if (options.invalidateOnSuccess === false) return;
			await invalidatePlayData(
				commandInvalidation({
					command,
				}),
			);
		},
	});
}
