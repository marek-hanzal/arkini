import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Command } from "./Command";
import type { CommandResult } from "./CommandResult";
import { applyOptimisticCommand } from "./applyOptimisticCommand";
import { commandInvalidation } from "./commandInvalidation";
import { rollbackOptimisticCommand } from "./rollbackOptimisticCommand";
import { runCommand } from "./runCommand";
import { queryKeyForTarget } from "~/play/hook/queryKeyForTarget";
import { usePlayDataInvalidation } from "~/play/hook/usePlayDataInvalidation";

export namespace useRunCommandMutation {
	export interface Options {
		invalidateOnSuccess?: boolean;
	}
}

export function useRunCommandMutation<TCommand extends Command = Command>(
	options: useRunCommandMutation.Options = {},
) {
	const queryClient = useQueryClient();
	const invalidatePlayData = usePlayDataInvalidation();

	return useMutation<CommandResult<TCommand>, Error, TCommand, applyOptimisticCommand.Snapshot>({
		async mutationFn(command) {
			return runCommand({
				command,
			});
		},
		async onMutate(command) {
			const targets = commandInvalidation({
				command,
			});
			await Promise.all(
				targets.map((target) =>
					queryClient.cancelQueries({
						queryKey: queryKeyForTarget(target),
					}),
				),
			);

			return applyOptimisticCommand({
				queryClient,
				command,
			});
		},
		onError(_error, _command, snapshot) {
			rollbackOptimisticCommand({
				queryClient,
				snapshot,
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
