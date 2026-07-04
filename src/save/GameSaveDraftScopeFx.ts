import { Context, Effect } from "effect";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import { cloneGameSaveFx } from "~/save/cloneGameSaveFx";

export namespace GameSaveDraftScopeFx {
	export interface Service {
		readonly save: GameSave;
		draft: GameSave | undefined;
	}
}

export class GameSaveDraftScopeFx extends Context.Tag("GameSaveDraftScopeFx")<
	GameSaveDraftScopeFx,
	GameSaveDraftScopeFx.Service
>() {
	//
}

export const provideGameSaveDraftScopeFx = <A, E, R>(
	effect: Effect.Effect<A, E, R | GameSaveDraftScopeFx>,
	{
		save,
	}: {
		save: GameSave;
	},
) =>
	Effect.provideService(effect, GameSaveDraftScopeFx, {
		draft: undefined,
		save,
	});

export const readGameSaveDraftCurrentFx = Effect.fn("readGameSaveDraftCurrentFx")(function* () {
	const scope = yield* GameSaveDraftScopeFx;
	return scope.draft ?? scope.save;
});

export const ensureGameSaveDraftFx = Effect.fn("ensureGameSaveDraftFx")(function* () {
	const scope = yield* GameSaveDraftScopeFx;
	if (!scope.draft) {
		scope.draft = yield* cloneGameSaveFx({
			save: scope.save,
		});
	}
	return scope.draft;
});

export const readUpdatedGameSaveDraftResultFx = Effect.fn("readUpdatedGameSaveDraftResultFx")(
	function* ({ nowMs }: { nowMs: number }) {
		const scope = yield* GameSaveDraftScopeFx;
		if (!scope.draft) return scope.save;

		scope.draft.updatedAtMs = nowMs;
		return scope.draft;
	},
);
