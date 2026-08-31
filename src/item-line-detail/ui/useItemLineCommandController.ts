import { Effect } from "effect";

import type { ItemDetailLinesProjection } from "~/item-line-detail/type/ItemDetailLinesProjection";
import { useItemDetailPendingCommand } from "~/item-detail-frame/ui/useItemDetailPendingCommand";
import { enqueueLineFx } from "~/production-job/fx/enqueueLineFx";
import { withdrawLineInputFx } from "~/production-input/fx/withdrawLineInputFx";
import { withdrawLineInputsFx } from "~/production-input/fx/withdrawLineInputsFx";
import { setDefaultLineFx } from "~/production-line/fx/setDefaultLineFx";
import { unsetDefaultLineFx } from "~/production-line/fx/unsetDefaultLineFx";

export namespace useItemLineCommandController {
	export interface Props {
		readonly line: Pick<ItemDetailLinesProjection.Line, "lineId">;
		readonly ownerItemId: string;
	}

	export interface Output {
		readonly enqueueFn: () => void;
		readonly error: string | null;
		readonly pending: {
			readonly default: boolean;
			readonly enqueue: boolean;
			readonly withdraw: boolean;
		};
		readonly setDefaultFn: () => void;
		readonly unsetDefaultFn: () => void;
		readonly withdrawFn: () => void;
	}
}

/** Owns the pending command lifecycle for one exact production line. */
export const useItemLineCommandController = ({
	line,
	ownerItemId,
}: useItemLineCommandController.Props): useItemLineCommandController.Output => {
	const pendingKeys = {
		default: JSON.stringify([
			"line",
			ownerItemId,
			line.lineId,
			"default",
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
	const setDefaultLine = useItemDetailPendingCommand({
		action: "default",
		failureMessage: "Default line could not be changed.",
		pendingKey: pendingKeys.default,
		runFx: (game, command: setDefaultLineFx.Props) => game.runFx(setDefaultLineFx(command)),
	});
	const enqueueLine = useItemDetailPendingCommand({
		action: "enqueue",
		failureMessage: "Work could not be queued.",
		pendingKey: pendingKeys.enqueue,
		runFx: (game, command: enqueueLineFx.Props) => game.runFx(enqueueLineFx(command)),
	});
	const unsetDefaultLine = useItemDetailPendingCommand({
		action: "default",
		failureMessage: "Default line could not be changed.",
		pendingKey: pendingKeys.default,
		runFx: (game, command: unsetDefaultLineFx.Props) => game.runFx(unsetDefaultLineFx(command)),
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
				setDefaultLine.error,
				unsetDefaultLine.error,
				withdrawLine.error,
			].find((message) => message !== null) ?? null,
		pending: {
			default: setDefaultLine.pending || unsetDefaultLine.pending,
			enqueue: enqueueLine.pending,
			withdraw: withdrawLine.pending,
		},
		setDefaultFn: () =>
			setDefaultLine.runFn({
				ownerItemId,
				lineId: line.lineId,
			}),
		unsetDefaultFn: () =>
			unsetDefaultLine.runFn({
				ownerItemId,
			}),
		withdrawFn: () =>
			withdrawLine.runFn({
				ownerItemId,
				lineId: line.lineId,
			}),
	};
};
