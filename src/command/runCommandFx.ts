import { Effect } from "effect";
import { mergeFx } from "~/board/fx/mergeFx";
import { moveFx } from "~/board/fx/moveFx";
import { swapFx as swapBoardFx } from "~/board/fx/swapFx";
import { placeFx } from "~/inventory/fx/placeFx";
import { stashFx } from "~/inventory/fx/stashFx";
import { swapFx as swapInventoryFx } from "~/inventory/fx/swapFx";
import { toGameActionError } from "~/play/logic/toGameActionError";
import { activateFx } from "~/activation/fx/activateFx";
import { withdrawInputFx } from "~/activation/fx/withdrawInputFx";
import { buyFx } from "~/upgrade/fx/buyFx";
import { claimCraftFx } from "~/craft/fx/claimCraftFx";
import type { Command } from "./Command";
import { CommandSchema } from "./CommandSchema";

export namespace runCommandFx {
	export interface Props {
		command: Command;
	}
}

export const runCommandFx = Effect.fn("runCommandFx")(function* ({ command }: runCommandFx.Props) {
	const input = yield* Effect.try({
		try: () => CommandSchema.parse(command),
		catch: toGameActionError,
	});

	switch (input.type) {
		case "board.move":
			return yield* moveFx({
				boardItemId: input.boardItemId,
				x: input.x,
				y: input.y,
			});
		case "board.swap":
			return yield* swapBoardFx({
				sourceBoardItemId: input.sourceBoardItemId,
				targetBoardItemId: input.targetBoardItemId,
			});
		case "board.merge":
			return yield* mergeFx({
				sourceBoardItemId: input.sourceBoardItemId,
				targetBoardItemId: input.targetBoardItemId,
			});
		case "inventory.swap":
			return yield* swapInventoryFx({
				sourceSlotIndex: input.sourceSlotIndex,
				targetSlotIndex: input.targetSlotIndex,
			});
		case "inventory.place":
			return yield* placeFx({
				slotIndex: input.slotIndex,
				x: input.x,
				y: input.y,
			});
		case "inventory.stash":
			return yield* stashFx({
				boardItemId: input.boardItemId,
				slotIndex: input.slotIndex,
			});
		case "activation.activate":
			return yield* activateFx({
				boardItemId: input.boardItemId,
				activation: input.activation,
			});
		case "activation.withdrawInput":
			return yield* withdrawInputFx({
				boardItemId: input.boardItemId,
				itemId: input.itemId,
			});
		case "upgrade.buy":
			return yield* buyFx({
				upgradeId: input.upgradeId,
			});
		case "craft.claim":
			return yield* claimCraftFx({
				boardItemId: input.boardItemId,
			});
	}
});
