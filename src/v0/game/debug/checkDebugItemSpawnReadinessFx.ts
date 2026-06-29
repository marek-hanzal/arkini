import { Effect } from "effect";
import { isItemStorageAllowed } from "~/v0/game/config/isItemStorageAllowed";
import { readBoardItemMaxCountCapacity } from "~/v0/game/board/readBoardItemMaxCountCapacity";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import { checkItemCreateBlockedByEffectsFx } from "~/v0/game/effects/checkItemCreateBlockedByEffectsFx";
import { cloneGameSaveFx } from "~/v0/game/save/cloneGameSaveFx";
import { planEmptyBoardCellsFx } from "~/v0/game/placement/planEmptyBoardCellsFx";
import { planItemBoardPlacementCellsFx } from "~/v0/game/placement/planItemBoardPlacementCellsFx";
import { readBoardItemCreateEffectFailureReason } from "~/v0/game/placement/readBoardItemCreateEffectFailureReason";
import type { GameActionDebugItemSpawn } from "~/v0/game/action/GameActionDebugItemSpawn";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace checkDebugItemSpawnReadinessFx {
	export interface Props {
		action: GameActionDebugItemSpawn;
		config: GameConfig;
		nowMs?: number;
		save: GameSave;
	}
}

const hasInventoryCapacity = ({
	config,
	itemId,
	quantity,
	save,
}: {
	config: GameConfig;
	itemId: string;
	quantity: number;
	save: GameSave;
}) => {
	const item = config.items[itemId];
	if (!item) return false;

	let available = 0;
	for (const slot of save.inventory.slots) {
		if (!slot) {
			available += item.maxStackSize;
			continue;
		}

		if ("kind" in slot) continue;
		if (slot.itemId !== itemId) continue;

		available += Math.max(0, item.maxStackSize - slot.quantity);
	}

	return available >= quantity;
};

export const checkDebugItemSpawnReadinessFx = Effect.fn("checkDebugItemSpawnReadinessFx")(
	function* ({ action, config, nowMs, save }: checkDebugItemSpawnReadinessFx.Props) {
		const item = config.items[action.itemId];
		if (!item) {
			return yield* Effect.fail(
				GameEngineError.configReferenceMissing(`Missing item "${action.itemId}".`),
			);
		}

		if (
			!isItemStorageAllowed({
				config,
				itemId: action.itemId,
				location: action.location,
			})
		) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"storage_restricted",
					`Item "${action.itemId}" cannot be spawned into ${action.location}.`,
				),
			);
		}

		const quantity = action.quantity ?? 1;

		if (action.location === "board") {
			const boardMaxCountCapacity = readBoardItemMaxCountCapacity({
				config,
				itemId: action.itemId,
				save,
			});
			if (boardMaxCountCapacity < quantity) {
				return yield* Effect.fail(
					GameEngineError.actionRejected(
						"board:max-count",
						`Board already has the maximum allowed count for "${action.itemId}".`,
					),
				);
			}

			const simulatedSave = yield* cloneGameSaveFx({
				save,
			});
			let effectFailureReason: "effect:block-create" | "effect:missing-grant" | undefined;
			for (let index = 0; index < quantity; index += 1) {
				const emptyCells = yield* planEmptyBoardCellsFx({
					config,
					save: simulatedSave,
				});
				if (emptyCells.length === 0) {
					return yield* Effect.fail(
						GameEngineError.actionRejected(
							"board:full",
							"Board has no space for debug item.",
						),
					);
				}

				const [targetCell] = yield* planItemBoardPlacementCellsFx({
					config,
					itemId: action.itemId,
					nowMs,
					save: simulatedSave,
				});
				if (!targetCell) {
					effectFailureReason = readBoardItemCreateEffectFailureReason({
						candidateCells: emptyCells,
						config,
						itemId: action.itemId,
						nowMs,
						save: simulatedSave,
					});
					break;
				}

				simulatedSave.board.items[`debug-readiness:${index}`] = {
					...(config.items[action.itemId]?.passiveEffectIds?.length
						? {
								createdAtMs: nowMs,
							}
						: {}),
					id: `debug-readiness:${index}`,
					itemId: action.itemId,
					x: targetCell.x,
					y: targetCell.y,
				};
			}

			if (effectFailureReason) {
				return yield* Effect.fail(
					GameEngineError.actionRejected(
						effectFailureReason,
						effectFailureReason === "effect:missing-grant"
							? "No board placement target has the required effect grant."
							: "No board placement target is allowed by active effects.",
					),
				);
			}
			return;
		}

		yield* checkItemCreateBlockedByEffectsFx({
			config,
			itemId: action.itemId,
			nowMs,
			save,
		});

		if (
			!hasInventoryCapacity({
				config,
				itemId: action.itemId,
				quantity,
				save,
			})
		) {
			return yield* Effect.fail(
				GameEngineError.actionRejected(
					"inventory:full",
					"Inventory has no space for debug item.",
				),
			);
		}
	},
);
