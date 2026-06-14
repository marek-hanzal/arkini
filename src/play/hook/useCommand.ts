import { useMutation } from "@tanstack/react-query";
import type { Command, CommandResult } from "~/action/command";
import { invalidation } from "~/action/invalidation";
import { run } from "~/action/run";
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
			return run({
				command,
			});
		},
		async onSuccess(_result, command) {
			if (options.invalidateOnSuccess === false) return;
			await invalidatePlayData(
				invalidation({
					command,
				}),
			);
		},
	});
}
