import { Effect } from "effect";
import type { BoardCell } from "~/v0/game/board/BoardCell";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import { GameEngineError } from "~/v0/game/engine/model/GameEngineError";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";
import { readGameEffectItemCreateBlockReasons } from "~/v0/game/effects/readGameEffectItemCreateBlockReasons";

export namespace checkItemCreateBlockedByEffectsFx {
	export interface Props {
		config: GameConfig;
		itemId: string;
		nowMs?: number;
		save: GameSave;
		targetCell?: BoardCell;
	}
}

export const checkItemCreateBlockedByEffectsFx = Effect.fn("checkItemCreateBlockedByEffectsFx")(
	function* ({
		config,
		itemId,
		nowMs,
		save,
		targetCell,
	}: checkItemCreateBlockedByEffectsFx.Props) {
		const blockReasons = readGameEffectItemCreateBlockReasons({
			config,
			itemId,
			nowMs,
			save,
			targetCell,
		});
		if (blockReasons.length === 0) return;

		const [firstReason] = blockReasons;
		return yield* Effect.fail(
			GameEngineError.actionRejected(
				"effect:block-create",
				firstReason?.reason ??
					`Item "${itemId}" cannot be created while effect "${firstReason?.effectName ?? "unknown"}" is active.`,
			),
		);
	},
);
