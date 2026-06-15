import { useCallback } from "react";
import { stageCommandVisualEvents } from "~/animation/stageCommandVisualEvents";
import type { Command } from "~/command/Command";
import type { CommandResult } from "~/command/CommandResult";
import { commandInvalidation } from "~/command/commandInvalidation";
import { useRunCommandMutation } from "~/command/useRunCommandMutation";
import type { DropCommitContext } from "~/drag/DropPlan";
import { usePlayDataInvalidation } from "~/play/hook/usePlayDataInvalidation";
import type { useVisualItemMotions } from "~/play/hook/useVisualItemMotions";
import type { ActiveSheet } from "~/play/logic/playSheetTypes";
import { waitForPaint } from "~/shared/util/waitForPaint";

export namespace usePlayCommandRunner {
	export interface Props {
		activeSheet?: ActiveSheet;
		visualMotions: Pick<useVisualItemMotions.State, "stage">;
	}
}

export const usePlayCommandRunner = ({
	activeSheet,
	visualMotions,
}: usePlayCommandRunner.Props) => {
	const invalidatePlayData = usePlayDataInvalidation();
	const command = useRunCommandMutation({
		invalidateOnSuccess: false,
	});
	const mutateCommand = command.mutateAsync;

	return useCallback(
		async <TCommand extends Command>(
			command: TCommand,
			context?: DropCommitContext,
		): Promise<CommandResult<TCommand>> => {
			const result = await mutateCommand(command);

			await waitForPaint();
			stageCommandVisualEvents({
				events: result.visualEvents,
				activeSheet,
				dragSourceRect: context?.dragRect ?? null,
				dragSourceActorKey: context?.dragActorKey,
				visualMotions,
			});

			void invalidatePlayData(
				commandInvalidation({
					command,
				}),
			).catch((error: unknown) => {
				console.error("play data invalidation failed after drag command", error);
			});

			return result as CommandResult<TCommand>;
		},
		[
			activeSheet,
			invalidatePlayData,
			mutateCommand,
			visualMotions,
		],
	);
};
