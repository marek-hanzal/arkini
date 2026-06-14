import { useCallback } from "react";
import type { Command } from "~/action/command";
import { useCommand } from "~/play/hook/useCommand";
import { usePlayDataInvalidation } from "~/play/hook/usePlayDataInvalidation";
import type { Feedback } from "~/play/hook/usePlayDraggableControl";
import { produceFrom } from "~/play/logic/produceFrom";
import type { ActiveSheet } from "~/play/logic/playSheetTypes";
import type { BoardViewItem } from "~/play/logic/playTypes";
import type { FlyerKind, VisualMeta, RectLike } from "~/play/types";

export namespace usePlayProducerActions {
	export interface Props {
		activeSheet?: ActiveSheet;
		addFlyer(
			itemId: string,
			from: RectLike,
			to: RectLike,
			kind?: FlyerKind,
			meta?: VisualMeta,
		): Promise<void>;
		feedback: Feedback;
		schedule(label: string, operation: () => Promise<void>): Promise<void>;
		hideSources(ids: readonly string[]): void;
		clearHiddenSources(): void;
	}
}

export const usePlayProducerActions = ({
	activeSheet,
	addFlyer,
	feedback,
	schedule,
	hideSources,
	clearHiddenSources,
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

	return {
		produceFrom: useCallback(
			(boardItem: BoardViewItem, activation: "single" | "exhaust" = "single") =>
				schedule(`producer ${activation}`, () =>
					produceFrom({
						activeSheet,
						boardItem,
						activation,
						addFlyer,
						run: command.mutateAsync,
						feedback,
						hideSources,
						clearHiddenSources,
						invalidatePlayData,
					}),
				),
			[
				activeSheet,
				addFlyer,
				clearHiddenSources,
				command.mutateAsync,
				feedback,
				hideSources,
				invalidatePlayData,
				schedule,
			],
		),
	};
};
