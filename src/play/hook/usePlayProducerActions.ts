import { useCallback, useMemo } from "react";
import type { Command } from "~/command/Command";
import { useCommand } from "~/play/hook/useCommand";
import { usePlayDataInvalidation } from "~/play/hook/usePlayDataInvalidation";
import type { Feedback } from "~/play/hook/usePlayDraggableControl";
import type { useVisualItemMotions } from "~/play/hook/useVisualItemMotions";
import { produceFrom } from "~/play/logic/produceFrom";
import type { ActiveSheet } from "~/play/logic/playSheetTypes";
import type { BoardViewItem } from "~/play/logic/playTypes";

export namespace usePlayProducerActions {
	export interface Props {
		activeSheet?: ActiveSheet;
		visualMotions: Pick<useVisualItemMotions.State, "stage">;
		feedback: Feedback;
		schedule(label: string, operation: () => Promise<void>): Promise<void>;
	}
}

export const usePlayProducerActions = ({
	activeSheet,
	visualMotions,
	feedback,
	schedule,
}: usePlayProducerActions.Props) => {
	const invalidatePlayData = usePlayDataInvalidation();
	const command = useCommand<
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
					activeSheet,
					boardItem,
					activation,
					visualMotions,
					run,
					feedback,
					invalidatePlayData,
				}),
			),
		[
			activeSheet,
			feedback,
			invalidatePlayData,
			run,
			schedule,
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
