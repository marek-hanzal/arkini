import { Effect } from "effect";
import { applyConfigLayerFx } from "~/v0/game/engine/fx/applyConfigLayerFx";
import { buildConfigLayerFx } from "~/v0/game/engine/fx/buildConfigLayerFx";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameConfigFxService } from "~/v0/game/engine/context/GameConfigFx";
import type { GameSave } from "~/v0/game/engine/model/GameSaveSchema";

export namespace buildGameConfigServiceFx {
	export interface Props {
		config: GameConfig;
		save: GameSave;
	}
}

export const buildGameConfigServiceFx = Effect.fn("buildGameConfigServiceFx")(function* ({
	config,
	save,
}: buildGameConfigServiceFx.Props) {
	const layer = yield* buildConfigLayerFx({
		config,
		save,
	});
	const effectiveConfig = yield* applyConfigLayerFx({
		config,
		layer,
	});

	return {
		baseConfig: config,
		config: effectiveConfig,
		layer,
	} satisfies GameConfigFxService;
});
