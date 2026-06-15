import { useCallback, useMemo } from "react";
import type { Command } from "~/command/Command";
import { useRunCommandMutation } from "~/command/useRunCommandMutation";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import { usePlayDataInvalidation } from "~/play/hook/usePlayDataInvalidation";
import { usePlayFeedbackState } from "~/play/hook/usePlayFeedbackState";
import { usePlaySchedule } from "~/play/hook/usePlaySchedule";
import { usePlaySheetsState } from "~/play/hook/usePlaySheetsState";
import { usePlayVisualMotionsState } from "~/play/hook/usePlayVisualMotionsState";
import { produceFrom } from "~/play/logic/produceFrom";

export namespace usePlayProducerActions {
	export interface Props {}
}

export const usePlayProducerActions = (_props?: usePlayProducerActions.Props) => {
	const sheets = usePlaySheetsState();
	const visualMotions = usePlayVisualMotionsState();
	const feedback = usePlayFeedbackState();
	const schedule = usePlaySchedule();
	const invalidatePlayData = usePlayDataInvalidation();
	const command = useRunCommandMutation<
		Extract<
			Command,
			{
				type: "producer.activate";
			}
		>
	>({
		invalidateOnSuccess: false,
	});
	const run = command.mutateAsync;

	const produce = useCallback(
		(boardItem: BoardViewItem, activation: "single" | "exhaust" = "single") =>
			schedule(`producer ${activation}`, () =>
				produceFrom({
					activeSheet: sheets.activeSheet,
					boardItem,
					activation,
					visualMotions,
					run,
					feedback,
					invalidatePlayData,
				}),
			),
		[
			feedback,
			invalidatePlayData,
			run,
			schedule,
			sheets.activeSheet,
			visualMotions,
		],
	);

	return useMemo(
		() => ({
			produceFrom: produce,
		}),
		[
			produce,
		],
	);
};
