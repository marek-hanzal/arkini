import { Effect } from "effect";
import { match } from "ts-pattern";
import { activateFx } from "~/activation/fx/activateFx";
import { withdrawInputFx } from "~/activation/fx/withdrawInputFx";
import { mergeFx } from "~/board/fx/mergeFx";
import { moveFx } from "~/board/fx/moveFx";
import { swapFx as swapBoardFx } from "~/board/fx/swapFx";
import { claimCraftFx } from "~/craft/fx/claimCraftFx";
import { placeFx } from "~/inventory/fx/placeFx";
import { stashFx } from "~/inventory/fx/stashFx";
import { swapFx as swapInventoryFx } from "~/inventory/fx/swapFx";
import { toGameActionError } from "~/play/logic/toGameActionError";
import { buyFx } from "~/upgrade/fx/buyFx";
import type { Command } from "./Command";
import { CommandSchema } from "./CommandSchema";

export namespace runCommandFx {
	export interface Props {
		command: Command;
	}
}

export const runCommandFx = Effect.fn("runCommandFx")(function* ({ command }: runCommandFx.Props) {
	const input = yield* Effect.tryPromise({
		try: () => CommandSchema.parseAsync(command),
		catch: toGameActionError,
	});
	const effect = match(input)
		.with(
			{
				type: "board.move",
			},
			(input) =>
				moveFx({
					boardItemId: input.boardItemId,
					x: input.x,
					y: input.y,
				}),
		)
		.with(
			{
				type: "board.swap",
			},
			(input) =>
				swapBoardFx({
					sourceBoardItemId: input.sourceBoardItemId,
					targetBoardItemId: input.targetBoardItemId,
				}),
		)
		.with(
			{
				type: "board.merge",
			},
			(input) =>
				mergeFx({
					sourceBoardItemId: input.sourceBoardItemId,
					targetBoardItemId: input.targetBoardItemId,
				}),
		)
		.with(
			{
				type: "inventory.swap",
			},
			(input) =>
				swapInventoryFx({
					sourceSlotIndex: input.sourceSlotIndex,
					targetSlotIndex: input.targetSlotIndex,
				}),
		)
		.with(
			{
				type: "inventory.place",
			},
			(input) =>
				placeFx({
					slotIndex: input.slotIndex,
					x: input.x,
					y: input.y,
				}),
		)
		.with(
			{
				type: "inventory.stash",
			},
			(input) =>
				stashFx({
					boardItemId: input.boardItemId,
					slotIndex: input.slotIndex,
				}),
		)
		.with(
			{
				type: "activation.activate",
			},
			(input) =>
				activateFx({
					boardItemId: input.boardItemId,
					activation: input.activation,
				}),
		)
		.with(
			{
				type: "activation.withdrawInput",
			},
			(input) =>
				withdrawInputFx({
					boardItemId: input.boardItemId,
					itemId: input.itemId,
				}),
		)
		.with(
			{
				type: "upgrade.buy",
			},
			(input) =>
				buyFx({
					upgradeId: input.upgradeId,
				}),
		)
		.with(
			{
				type: "craft.claim",
			},
			(input) =>
				claimCraftFx({
					boardItemId: input.boardItemId,
				}),
		)
		.exhaustive();

	return yield* effect;
});
