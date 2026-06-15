import type { CommandVisualEventSchema } from "~/command/CommandVisualEventSchema";
import type { useVisualItemMotions } from "~/play/hook/useVisualItemMotions";
import type { ActiveSheet } from "~/play/logic/playSheetTypes";
import { commandVisualEventStageEntries } from "./logic/commandVisualEventStageEntries";

export namespace stageCommandVisualEvents {
	export interface Props {
		events: readonly CommandVisualEventSchema.Type[];
		activeSheet?: ActiveSheet;
		visualMotions: Pick<useVisualItemMotions.State, "stage">;
	}
}

export const stageCommandVisualEvents = ({
	events,
	activeSheet,
	visualMotions,
}: stageCommandVisualEvents.Props) => {
	visualMotions.stage(
		commandVisualEventStageEntries({
			events,
			activeSheet,
		}),
	);
};
