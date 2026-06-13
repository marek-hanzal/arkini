import { Effect } from "effect";
import {
	GameConfigServiceFx,
	type GameConfigService,
} from "~/manifest/context/GameConfigServiceFx";

export function withGameConfigService(gameConfig: GameConfigService) {
	return <A, E, R>(effect: Effect.Effect<A, E, R>) => {
		return effect.pipe(Effect.provideService(GameConfigServiceFx, gameConfig));
	};
}
