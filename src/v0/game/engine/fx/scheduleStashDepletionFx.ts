import { Effect } from "effect";
import { match } from "ts-pattern";
import { scheduleBoardItemRemoveFx } from "~/v0/game/engine/fx/scheduleBoardItemRemoveFx";
import { scheduleBoardItemReplaceFx } from "~/v0/game/engine/fx/scheduleBoardItemReplaceFx";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace scheduleStashDepletionFx {
	export interface Props {
		save: GameSave;
		stashItemInstanceId: string;
		stashItemId: string;
		onDepleted:
			| "remove"
			| {
					replaceWithItemId: string;
			  };
		dueAtMs: number;
		afterEventIds: string[];
	}
}

export const scheduleStashDepletionFx = Effect.fn("scheduleStashDepletionFx")(function* ({
	save,
	stashItemInstanceId,
	stashItemId,
	onDepleted,
	dueAtMs,
	afterEventIds,
}: scheduleStashDepletionFx.Props) {
	return yield* match(onDepleted)
		.with("remove", () =>
			scheduleBoardItemRemoveFx({
				afterEventIds,
				dueAtMs,
				itemId: stashItemId,
				itemInstanceId: stashItemInstanceId,
				reason: "stash-depleted",
				save,
			}),
		)
		.otherwise((replace) =>
			scheduleBoardItemReplaceFx({
				afterEventIds,
				dueAtMs,
				fromItemId: stashItemId,
				itemInstanceId: stashItemInstanceId,
				reason: "stash-depleted",
				save,
				toItemId: replace.replaceWithItemId,
			}),
		);
});
