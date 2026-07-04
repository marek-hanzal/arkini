import { Context, Effect } from "effect";
import { match } from "ts-pattern";
import type { GameActionResolvedInputRef } from "~/action/GameActionResolvedInputRef";
import { removeBoardItemRuntimeStateFx } from "~/board/logic/removeBoardItemRuntimeStateFx";
import { GameEngineError } from "~/engine/model/GameEngineError";
import type { GameEvent } from "~/event/GameEventSchema";
import {
	isGameSaveInventoryInstance,
	readGameSaveInventorySlotQuantity,
} from "~/inventory/model/GameSaveInventorySlot";
import type { GameSave, GameSaveInventoryStack } from "~/engine/model/GameSaveSchema";

export namespace consumeResolvedInputRefFx {
	export interface Props {
		nextSave: GameSave;
		ref: GameActionResolvedInputRef;
		events: GameEvent[];
		reason: Extract<
			GameEvent,
			{
				type: "item.consumed";
			}
		>["reason"];
	}
}

class ConsumeResolvedInputRefScopeFx extends Context.Tag("ConsumeResolvedInputRefScopeFx")<
	ConsumeResolvedInputRefScopeFx,
	Pick<consumeResolvedInputRefFx.Props, "events" | "nextSave" | "reason">
>() {
	//
}

const pushConsumedEvent = ({
	event,
}: {
	event: Extract<
		GameEvent,
		{
			type: "item.consumed";
		}
	>;
}) =>
	Effect.gen(function* () {
		const { events } = yield* ConsumeResolvedInputRefScopeFx;
		events.push(event);
	});

const consumeBoardInputRefFx = Effect.fn("consumeResolvedInputRefFx.consumeBoardInputRefFx")(
	function* (
		boardRef: Extract<
			GameActionResolvedInputRef,
			{
				kind: "board";
			}
		>,
	) {
		const { nextSave, reason } = yield* ConsumeResolvedInputRefScopeFx;
		delete nextSave.board.items[boardRef.itemInstanceId];
		yield* removeBoardItemRuntimeStateFx({
			itemInstanceId: boardRef.itemInstanceId,
			save: nextSave,
		});
		yield* pushConsumedEvent({
			event: {
				from: {
					kind: "board",
					itemInstanceId: boardRef.itemInstanceId,
				},
				itemId: boardRef.itemId,
				reason,
				type: "item.consumed" as const,
			},
		});
	},
);

const createRemainingInventoryStack = ({
	nextQuantity,
	slot,
}: {
	nextQuantity: number;
	slot: GameSaveInventoryStack;
}) =>
	nextQuantity === 0
		? null
		: ({
				...(slot.createdAtMs !== undefined
					? {
							createdAtMs: slot.createdAtMs,
						}
					: {}),
				itemId: slot.itemId,
				quantity: nextQuantity,
			} satisfies GameSaveInventoryStack);

const consumeInventoryInputRefFx = Effect.fn(
	"consumeResolvedInputRefFx.consumeInventoryInputRefFx",
)(function* (
	inventoryRef: Extract<
		GameActionResolvedInputRef,
		{
			kind: "inventory";
		}
	>,
) {
	const { nextSave, reason } = yield* ConsumeResolvedInputRefScopeFx;
	const slot = nextSave.inventory.slots[inventoryRef.slotIndex];
	if (!slot) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"input_unavailable",
				`Missing inventory input at slot ${inventoryRef.slotIndex}.`,
			),
		);
	}

	const previousQuantity = readGameSaveInventorySlotQuantity(slot);
	const nextQuantity = previousQuantity - inventoryRef.quantity;
	if (nextQuantity < 0) {
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"input_unavailable",
				`Inventory input at slot ${inventoryRef.slotIndex} is already spent.`,
			),
		);
	}

	if (isGameSaveInventoryInstance(slot)) {
		nextSave.inventory.slots[inventoryRef.slotIndex] = null;
		yield* removeBoardItemRuntimeStateFx({
			itemInstanceId: slot.id,
			save: nextSave,
		});
	} else {
		nextSave.inventory.slots[inventoryRef.slotIndex] = createRemainingInventoryStack({
			nextQuantity,
			slot,
		});
	}

	yield* pushConsumedEvent({
		event: {
			from: {
				kind: "inventory",
				nextQuantity,
				previousQuantity,
				quantity: inventoryRef.quantity,
				slotIndex: inventoryRef.slotIndex,
			},
			itemId: inventoryRef.itemId,
			reason,
			type: "item.consumed" as const,
		},
	});
});

const consumeResolvedInputRefProgramFx = Effect.fn(
	"consumeResolvedInputRefFx.consumeResolvedInputRefProgramFx",
)(function* ({ ref }: { ref: GameActionResolvedInputRef }) {
	return yield* match(ref)
		.with(
			{
				kind: "board",
			},
			consumeBoardInputRefFx,
		)
		.with(
			{
				kind: "inventory",
			},
			consumeInventoryInputRefFx,
		)
		.exhaustive();
});

export const consumeResolvedInputRefFx = Effect.fn("consumeResolvedInputRefFx")(function* ({
	events,
	nextSave,
	reason,
	ref,
}: consumeResolvedInputRefFx.Props) {
	return yield* consumeResolvedInputRefProgramFx({
		ref,
	}).pipe(
		Effect.provideService(ConsumeResolvedInputRefScopeFx, {
			events,
			nextSave,
			reason,
		}),
	);
});
