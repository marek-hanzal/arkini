import { Effect } from "effect";
import { applyGameActionFx } from "~/v0/game/engine/fx/applyGameActionFx";
import { createInitialGameSaveFx } from "~/v0/game/engine/fx/createInitialGameSaveFx";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { TestRandomService } from "~/v0/game/engine/test/TestRandomService";
import { withRandomService } from "~/v0/random/logic/withRandomService";

export const runAction = (props: applyGameActionFx.Props) =>
	Effect.runSync(applyGameActionFx(props).pipe(withRandomService(TestRandomService)));

export const runInitialSave = (props: createInitialGameSaveFx.Props) =>
	Effect.runSync(createInitialGameSaveFx(props));

export const runActionEither = (props: applyGameActionFx.Props) =>
	Effect.runSync(
		Effect.either(applyGameActionFx(props).pipe(withRandomService(TestRandomService))),
	);

export const readOnlyRecordValue = <T>(record: Record<string, T>) => {
	const values = Object.values(record);
	if (values.length !== 1) {
		throw new Error(`Expected exactly one record value, got ${values.length}.`);
	}
	return values[0] as T;
};

export const findBoardItem = (
	save: GameSave,
	matcher: {
		itemId: string;
		x: number;
		y: number;
	},
) =>
	Object.values(save.board.items).find(
		(item) => item.itemId === matcher.itemId && item.x === matcher.x && item.y === matcher.y,
	);
