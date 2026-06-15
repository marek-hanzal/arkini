import { Effect } from "effect";
import { GameConfigServiceFx, type GameConfigService } from "~/v0/game/context/GameConfigServiceFx";

export function withGameConfigService(gameConfig: GameConfigService) {
	return <A, E, R>(effect: Effect.Effect<A, E, R>) => {
		return effect.pipe(Effect.provideService(GameConfigServiceFx, gameConfig));
	};
}
