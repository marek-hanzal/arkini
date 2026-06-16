import { Effect } from "effect";
import { createInitialBoardState } from "~/v0/board/logic/createInitialBoardState";
import { dbFx } from "~/v0/database/fx/dbFx";
import { DateServiceFx } from "~/v0/date/context/DateServiceFx";
import type { BoardRow } from "~/v0/board/model/BoardRow";
import { GameConfigServiceFx } from "~/v0/game/context/GameConfigServiceFx";
import type { StashDefinition } from "~/v0/manifest/activation/StashDefinition";
import { resolveActivationDepletion } from "~/v0/activation/logic/resolveActivationDepletion";
import { json } from "~/v0/serialization/json";

export namespace depleteActivationFx {
	export interface Props {
		row: BoardRow;
		stash: StashDefinition;
	}
}

export const depleteActivationFx = Effect.fn("depleteActivationFx")(function* ({
	row,
	stash,
}: depleteActivationFx.Props) {
	const date = yield* DateServiceFx;
	const gameConfig = yield* GameConfigServiceFx;
	const timestamp = date.timestamp();

	const depletion = resolveActivationDepletion(stash);

	if (depletion.kind === "remove") {
		return yield* dbFx(async (db) => {
			await db
				.deleteFrom("itemInstance")
				.where("locationKind", "=", "activation-input")
				.where("ownerItemInstanceId", "=", row.id)
				.execute();
			await db.deleteFrom("itemInstance").where("id", "=", row.id).execute();
			return depletion;
		});
	}

	return yield* dbFx(async (db) => {
		await db
			.deleteFrom("itemInstance")
			.where("locationKind", "=", "activation-input")
			.where("ownerItemInstanceId", "=", row.id)
			.execute();
		await db
			.updateTable("itemInstance")
			.set({
				itemDefinitionId: depletion.itemId,
				stateJson: json(createInitialBoardState(depletion.itemId, gameConfig)),
				updatedAt: timestamp,
			})
			.where("id", "=", row.id)
			.execute();
		return depletion;
	});
});
