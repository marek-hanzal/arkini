import { Effect } from "effect";
import { match, P } from "ts-pattern";
import type { PlaceInventoryItemOnBoardProps } from "~/placement/InventoryItemOnBoardPlacementTypes";
import { placeInventoryInstanceOnBoardFx } from "~/placement/placeInventoryInstanceOnBoardFx";
import { placeInventoryStackOnBoardFx } from "~/placement/placeInventoryStackOnBoardFx";
import { readInventoryPlacementStateFx } from "~/placement/readInventoryPlacementStateFx";
import {
	isGameSaveInventoryInstance,
	isGameSaveInventoryStack,
} from "~/inventory/model/GameSaveInventorySlot";

export namespace placeInventoryItemOnBoardFx {
	export interface Props extends PlaceInventoryItemOnBoardProps {}
}

export const placeInventoryItemOnBoardFx = Effect.fn("placeInventoryItemOnBoardFx")(function* (
	props: placeInventoryItemOnBoardFx.Props,
) {
	const state = yield* readInventoryPlacementStateFx(props);
	return yield* match(state)
		.with(
			{
				liveSlot: P.when(isGameSaveInventoryInstance),
			},
			(instanceState) =>
				placeInventoryInstanceOnBoardFx({
					props,
					state: {
						...instanceState,
						liveSlot: instanceState.liveSlot,
					},
				}),
		)
		.with(
			{
				liveSlot: P.when(isGameSaveInventoryStack),
			},
			(stackState) =>
				placeInventoryStackOnBoardFx({
					props,
					state: {
						...stackState,
						liveSlot: stackState.liveSlot,
					},
				}),
		)
		.exhaustive();
});
