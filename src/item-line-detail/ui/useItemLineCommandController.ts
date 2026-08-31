import { Effect } from "effect";

import type { ItemDetailLinesProjection } from "~/item-line-detail/type/ItemDetailLinesProjection";
import { useItemDetailPendingCommand } from "~/item-detail-frame/ui/useItemDetailPendingCommand";
import { enqueueLineFx } from "~/production-job/write/enqueueLineFx";
import { withdrawLineInputFx } from "~/production-input/fx/withdrawLineInputFx";
import { withdrawLineInputsFx } from "~/production-input/fx/withdrawLineInputsFx";
import { setDefaultLineFx } from "~/production-line/write/setDefaultLineFx";
import { unsetDefaultLineFx } from "~/production-line/write/unsetDefaultLineFx";

export namespace useItemLineCommandController {
	export interface Props {
		readonly line: Pick<ItemDetailLinesProjection.Line, "lineId">;
		readonly ownerItemId: string;
	}

	export interface Output {
		readonly enqueue: () => void;
		readonly error: string | null;
		readonly pending: {
			readonly default: boolean;
			readonly enqueue: boolean;
			readonly withdraw: boolean;
		};
		readonly setDefault: () => void;
		readonly unsetDefault: () => void;
		readonly withdraw: () => void;
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
		run: (game, command: setDefaultLineFx.Props) => game.runFx(setDefaultLineFx(command)),
	});
	const enqueueLine = useItemDetailPendingCommand({
		action: "enqueue",
		failureMessage: "Work could not be queued.",
		pendingKey: pendingKeys.enqueue,
		run: (game, command: enqueueLineFx.Props) => game.runFx(enqueueLineFx(command)),
	});
	const unsetDefaultLine = useItemDetailPendingCommand({
		action: "default",
		failureMessage: "Default line could not be changed.",
		pendingKey: pendingKeys.default,
		run: (game, command: unsetDefaultLineFx.Props) => game.runFx(unsetDefaultLineFx(command)),
	});
	const withdrawLine = useItemDetailPendingCommand({
		action: "withdraw",
		failureMessage: "Inputs could not be withdrawn.",
		pendingKey: pendingKeys.withdraw,
		run: (game, command: withdrawLineInputFx.Props | withdrawLineInputsFx.Props) =>
			game
				.runFx(
					"inputIndex" in command
						? withdrawLineInputFx(command)
						: withdrawLineInputsFx(command),
				)
				.pipe(Effect.asVoid),
	});

	return {
		enqueue: () =>
			enqueueLine.run({
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
		setDefault: () =>
			setDefaultLine.run({
				ownerItemId,
				lineId: line.lineId,
			}),
		unsetDefault: () =>
			unsetDefaultLine.run({
				ownerItemId,
			}),
		withdraw: () =>
			withdrawLine.run({
				ownerItemId,
				lineId: line.lineId,
			}),
	};
};
