import { Effect } from "effect";
import { cloneGameSaveFx } from "~/v0/game/save/cloneGameSaveFx";
import type { GameEngineResult } from "~/v0/game/engine/model/GameEngineResult";
import type { GameEvent } from "~/v0/game/event/GameEventSchema";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace processExpiredActiveEffectsFx {
	export interface Props {
		nowMs: number;
		save: GameSave;
	}
}

export const processExpiredActiveEffectsFx = Effect.fn("processExpiredActiveEffectsFx")(function* ({
	nowMs,
	save,
}: processExpiredActiveEffectsFx.Props) {
	const expiredEffects = Object.values(save.activeEffects ?? {}).filter(
		(effect) => effect.expiresAtMs <= nowMs,
	);

	if (expiredEffects.length === 0) {
		return {
			events: [],
			nextWakeAtMs: null,
			save,
		} satisfies GameEngineResult;
	}

	const nextSave = yield* cloneGameSaveFx({
		save,
	});
	const events: GameEvent[] = [];

	for (const effect of expiredEffects) {
		delete nextSave.activeEffects[effect.id];
		events.push({
			effectId: effect.effectId,
			expiredAtMs: nowMs,
			id: effect.id,
			sourceItemInstanceId: effect.sourceItemInstanceId,
			type: "effect.expired" as const,
		});
	}

	nextSave.updatedAtMs = nowMs;

	return {
		events,
		nextWakeAtMs: null,
		save: nextSave,
	} satisfies GameEngineResult;
});
