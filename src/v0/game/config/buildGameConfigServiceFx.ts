import { Effect } from "effect";
import type { GameConfig } from "~/v0/game/config/GameConfigSchema";
import type { GameConfigFxService } from "~/v0/game/config/GameConfigFx";

export namespace buildGameConfigServiceFx {
	export interface Props {
		config: GameConfig;
	}
}

export const buildGameConfigServiceFx = Effect.fn("buildGameConfigServiceFx")(function* ({
	config,
}: buildGameConfigServiceFx.Props) {
	return {
		config,
	} satisfies GameConfigFxService;
});
