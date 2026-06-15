import { useCallback, useMemo } from "react";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import type { Command } from "~/command/Command";
import { useRunCommandMutation } from "~/command/useRunCommandMutation";
import { usePlayDataInvalidation } from "~/play/hook/usePlayDataInvalidation";
import { usePlayFeedbackState } from "~/play/hook/usePlayFeedbackState";
import { usePlaySchedule } from "~/play/hook/usePlaySchedule";
import { usePlaySheetsState } from "~/play/hook/usePlaySheetsState";
import { usePlayVisualMotionsState } from "~/play/hook/usePlayVisualMotionsState";
import { claimCraftFrom } from "~/play/logic/claimCraftFrom";

export namespace usePlayCraftActions {
	export interface Props {}
}

export const usePlayCraftActions = (_props?: usePlayCraftActions.Props) => {
	const sheets = usePlaySheetsState();
	const visualMotions = usePlayVisualMotionsState();
	const feedback = usePlayFeedbackState();
	const schedule = usePlaySchedule();
	const invalidatePlayData = usePlayDataInvalidation();
	const command = useRunCommandMutation<
		Extract<
			Command,
			{
				type: "craft.claim";
			}
		>
	>({
		invalidateOnSuccess: false,
	});
	const run = command.mutateAsync;

	const claim = useCallback(
		(boardItem: BoardViewItem) =>
			schedule("craft claim", () =>
				claimCraftFrom({
					activeSheet: sheets.activeSheet,
					boardItem,
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
			claimFrom: claim,
		}),
		[
			claim,
		],
	);
};
