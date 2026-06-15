import type { FC, PropsWithChildren } from "react";
import { PlayDragContext } from "~/play/context/PlayDragContext";
import { PlayFeedbackContext } from "~/play/context/PlayFeedbackContext";
import { PlayScheduleContext } from "~/play/context/PlayScheduleContext";
import { PlaySheetsContext } from "~/play/context/PlaySheetsContext";
import { PlayVisualMotionsContext } from "~/play/context/PlayVisualMotionsContext";
import { usePlayDraggableControl } from "~/play/hook/usePlayDraggableControl";
import { usePlayEventQueue } from "~/play/hook/usePlayEventQueue";
import { usePlayFeedback } from "~/play/hook/usePlayFeedback";
import { usePlaySave } from "~/play/hook/usePlaySave";
import { usePlaySheets } from "~/play/hook/usePlaySheets";
import { useVisualItemMotions } from "~/play/hook/useVisualItemMotions";

export namespace PlaySessionProvider {
	export interface Props extends PropsWithChildren {}
}

export const PlaySessionProvider: FC<PlaySessionProvider.Props> = ({ children }) => {
	usePlaySave();

	const sheets = usePlaySheets();
	const visualMotions = useVisualItemMotions();
	const schedule = usePlayEventQueue();
	const feedback = usePlayFeedback();
	const drag = usePlayDraggableControl({
		activeSheet: sheets.activeSheet,
		feedback,
		schedule,
		visualMotions,
	});

	return (
		<PlaySheetsContext.Provider value={sheets}>
			<PlayVisualMotionsContext.Provider value={visualMotions}>
				<PlayScheduleContext.Provider value={schedule}>
					<PlayFeedbackContext.Provider value={feedback}>
						<PlayDragContext.Provider value={drag}>{children}</PlayDragContext.Provider>
					</PlayFeedbackContext.Provider>
				</PlayScheduleContext.Provider>
			</PlayVisualMotionsContext.Provider>
		</PlaySheetsContext.Provider>
	);
};
