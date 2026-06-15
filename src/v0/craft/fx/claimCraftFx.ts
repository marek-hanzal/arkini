import { Effect } from "effect";
import type { ActionResultSchema } from "~/v0/play/action/ActionResultSchema";
import { createInitialBoardState } from "~/v0/board/logic/createInitialBoardState";
import { readBoardState } from "~/v0/board/logic/readBoardState";
import { GameActionError } from "~/v0/play/action/GameActionError";
import { deleteCraftInputsFx } from "~/v0/craft/fx/deleteCraftInputsFx";
import { readCraftInputRowsFx } from "~/v0/craft/fx/readCraftInputRowsFx";
import { resolveCraftProgress } from "~/v0/craft/logic/resolveCraftProgress";
import { ClaimCraftInputSchema } from "~/v0/craft/type/ClaimCraftInputSchema";
import type { CraftResultSchema } from "~/v0/craft/type/CraftResultSchema";
import { dbFx } from "~/v0/database/fx/dbFx";
import { withTransactionFx } from "~/v0/database/fx/withTransactionFx";
import { DateServiceFx } from "~/v0/date/context/DateServiceFx";
import { GameConfigServiceFx } from "~/v0/game/context/GameConfigServiceFx";
import type { ItemId } from "~/v0/manifest/manifestId";
import { readMutableSaveFx } from "~/v0/play/fx/readMutableSaveFx";
import { toGameActionError } from "~/v0/play/action/toGameActionError";
import { json } from "~/v0/serialization/json";
import { groupCraftInputRows } from "../logic/groupCraftInputRows";

export namespace claimCraftFx {
	export interface Props {
		boardItemId: string;
	}
}

export const claimCraftFx = Effect.fn("claimCraftFx")(function* (props: claimCraftFx.Props) {
	const input = yield* Effect.tryPromise({
		try: () => ClaimCraftInputSchema.parseAsync(props),
		catch: toGameActionError,
	});

	return yield* withTransactionFx(
		Effect.gen(function* () {
			const date = yield* DateServiceFx;
			const gameConfig = yield* GameConfigServiceFx;
			const timestamp = date.timestamp();
			const nowMs = date.nowMs();
			const { boardRows } = yield* readMutableSaveFx();
			const row = boardRows.find((entry) => entry.id === input.boardItemId);
			if (!row) {
				return yield* Effect.fail(new GameActionError("Board item does not exist."));
			}

			const recipe = gameConfig.getCraftRecipeForTarget(row.itemDefinitionId);
			if (!recipe) {
				return yield* Effect.fail(new GameActionError("This item cannot be crafted."));
			}

			const state = readBoardState(row);
			const inputRows = yield* readCraftInputRowsFx({
				ownerItemInstanceIds: [
					row.id,
				],
			});
			const storedInputs =
				groupCraftInputRows(inputRows).get(row.id) ?? new Map<ItemId, number>();
			const progress = resolveCraftProgress({
				recipe,
				storedInputs,
			});
			if (!progress.inputsComplete) {
				return yield* Effect.fail(new GameActionError("Craft inputs are incomplete."));
			}

			const readyAtMs = state.craft?.readyAt
				? date.parseTimestampMs(state.craft.readyAt)
				: recipe.durationMs === 0
					? nowMs
					: undefined;
			if (readyAtMs === undefined) {
				return yield* Effect.fail(new GameActionError("Craft has not started."));
			}
			if (readyAtMs > nowMs) {
				return yield* Effect.fail(new GameActionError("Craft is not ready yet."));
			}

			yield* deleteCraftInputsFx({
				ownerItemInstanceId: row.id,
			});
			yield* dbFx((db) =>
				db
					.updateTable("itemInstance")
					.set({
						itemDefinitionId: recipe.resultItemId,
						stateJson: json(createInitialBoardState(recipe.resultItemId, gameConfig)),
						updatedAt: timestamp,
					})
					.where("id", "=", row.id)
					.execute(),
			);

			const craft = {
				boardItemId: row.id,
				recipeId: recipe.id,
				sourceItemId: row.itemDefinitionId as ItemId,
				resultItemId: recipe.resultItemId,
			} satisfies CraftResultSchema.Type;

			return {
				craft,
				visualEvents: [
					{
						type: "craft.claimed",
						itemInstanceId: row.id,
						recipeId: recipe.id,
						sourceItemId: row.itemDefinitionId as ItemId,
						resultItemId: recipe.resultItemId,
					},
				],
			} satisfies ActionResultSchema.Type & {
				craft: CraftResultSchema.Type;
			};
		}),
	);
});
