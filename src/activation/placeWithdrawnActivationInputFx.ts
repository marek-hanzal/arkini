import { Effect } from "effect";
import type { BoardCell } from "~/board/BoardCellPosition";
import type { GameConfig } from "~/config/GameConfigTypes";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { placeGameSaveItemsFx } from "~/placement/placeGameSaveItemsFx";

export namespace placeWithdrawnActivationInputFx {
	export interface Props {
		config: GameConfig;
		failureSubject: "Craft" | "Producer";
		itemId: string;
		nowMs: number;
		originItemInstanceId: string;
		quantity: number;
		reason: "craft-input-withdraw" | "producer-input-withdraw";
		save: GameSave;
		seedCell: BoardCell;
	}
}

export const placeWithdrawnActivationInputFx = Effect.fn("placeWithdrawnActivationInputFx")(
	function* ({
		config,
		failureSubject,
		itemId,
		nowMs,
		originItemInstanceId,
		quantity,
		reason,
		save,
		seedCell,
	}: placeWithdrawnActivationInputFx.Props) {
		return yield* placeGameSaveItemsFx({
			config,
			items: [
				{
					itemId,
					originItemInstanceId,
					quantity,
					reason,
				},
			],
			nowMs,
			save,
			seedCell,
		}).pipe(
			Effect.catchTag("GamePlacementFailed", (error) =>
				Effect.fail(
					GameEngineError.actionRejected(
						error.reason,
						`${failureSubject} input "${itemId}" cannot be withdrawn because there is no placement space.`,
					),
				),
			),
		);
	},
);
