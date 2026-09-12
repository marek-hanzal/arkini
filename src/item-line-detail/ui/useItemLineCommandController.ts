import { Effect } from "effect";

import type { ItemDetailLinesProjection } from "~/item-line-detail/type/ItemDetailLinesProjection";
import { useItemDetailPendingCommand } from "~/item-detail-frame/ui/useItemDetailPendingCommand";
import { enqueueLineFx } from "~/production-job/fx/enqueueLineFx";
import { withdrawLineInputFx } from "~/production-input/fx/withdrawLineInputFx";
import { withdrawLineInputsFx } from "~/production-input/fx/withdrawLineInputsFx";
import { setLineSelectionFx } from "~/production-line/fx/setLineSelectionFx";
import { useTranslator } from "~/translation/ui/useTranslator";

export namespace useItemLineCommandController {
	export interface Props {
		readonly line: Pick<ItemDetailLinesProjection.Line, "lineId">;
		readonly ownerItemId: string;
	}

	export interface Output {
		readonly enqueueFn: () => void;
		readonly error: string | null;
		readonly pending: {
			readonly selection: boolean;
			readonly enqueue: boolean;
			readonly withdraw: boolean;
		};
		readonly selectFn: (selection: "default" | "clock", selected: boolean) => void;
		readonly withdrawFn: () => void;
	}
}

/** Owns the pending command lifecycle for one exact production line. */
export const useItemLineCommandController = ({
	line,
	ownerItemId,
}: useItemLineCommandController.Props): useItemLineCommandController.Output => {
	const translator = useTranslator();
	const pendingKeys = {
		selection: JSON.stringify([
			"line",
			ownerItemId,
			"selection",
		]),
		enqueue: JSON.stringify([
			"line",
			ownerItemId,
			line.lineId,
			"enqueue",
		]),
		withdraw: JSON.stringify([
			"line",
			ownerItemId,
			line.lineId,
			"withdraw",
		]),
	} as const;
	const selectLine = useItemDetailPendingCommand({
		action: "selection",
		failureMessage: translator.textFn("Line selection could not be changed."),
		pendingKey: pendingKeys.selection,
		runFx: (game, command: setLineSelectionFx.Props) => game.runFx(setLineSelectionFx(command)),
	});
	const enqueueLine = useItemDetailPendingCommand({
		action: "enqueue",
		failureMessage: "Work could not be queued.",
		pendingKey: pendingKeys.enqueue,
		runFx: (game, command: enqueueLineFx.Props) => game.runFx(enqueueLineFx(command)),
	});
	const withdrawLine = useItemDetailPendingCommand({
		action: "withdraw",
		failureMessage: "Inputs could not be withdrawn.",
		pendingKey: pendingKeys.withdraw,
		runFx: (game, command: withdrawLineInputFx.Props | withdrawLineInputsFx.Props) =>
			game
				.runFx(
					"inputIndex" in command
						? withdrawLineInputFx(command)
						: withdrawLineInputsFx(command),
				)
				.pipe(Effect.asVoid),
	});

	return {
		enqueueFn: () =>
			enqueueLine.runFn({
				ownerItemId,
				lineId: line.lineId,
			}),
		error:
			[
				enqueueLine.error,
				selectLine.error,
				withdrawLine.error,
			].find((message) => message !== null) ?? null,
		pending: {
			selection: selectLine.pending,
			enqueue: enqueueLine.pending,
			withdraw: withdrawLine.pending,
		},
		selectFn: (selection, selected) =>
			selectLine.runFn({
				ownerItemId,
				selection,
				lineId: selected ? line.lineId : null,
			}),
		withdrawFn: () =>
			withdrawLine.runFn({
				ownerItemId,
				lineId: line.lineId,
			}),
	};
};
