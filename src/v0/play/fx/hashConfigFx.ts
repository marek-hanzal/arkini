import { Effect } from "effect";
import { HashServiceFx } from "~/v0/hash/context/HashServiceFx";
import type { GameConfig } from "~/v0/manifest/GameConfig";
import { tryGameAction } from "./tryGameAction";

export namespace hashConfigFx {
	export interface Props {
		config: GameConfig;
	}
}

export const hashConfigFx = Effect.fn("hashConfigFx")(function* ({ config }: hashConfigFx.Props) {
	const hash = yield* HashServiceFx;
	return yield* tryGameAction(() => hash.gameConfig(config));
});
