import { Effect } from "effect";
import { HashServiceFx } from "~/hash/context/HashServiceFx";
import type { GameConfig } from "~/manifest/data/GameConfig";
import { tryGameAction } from "../logic/tryGameAction";

export namespace hashConfigFx {
	export interface Props {
		config: GameConfig;
	}
}

export const hashConfigFx = Effect.fn("hashConfigFx")(function* ({ config }: hashConfigFx.Props) {
	const hash = yield* HashServiceFx;
	return yield* tryGameAction(() => hash.gameConfig(config));
});
