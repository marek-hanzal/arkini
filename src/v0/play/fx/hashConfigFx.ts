import { Effect } from "effect";
import { HashServiceFx } from "~/v0/hash/context/HashServiceFx";
import type { GameConfig } from "~/v0/manifest/GameConfig";
import { tryGameActionFx } from "~/v0/play/action/tryGameActionFx";

export namespace hashConfigFx {
	export interface Props {
		config: GameConfig;
	}
}

export const hashConfigFx = Effect.fn("hashConfigFx")(function* ({ config }: hashConfigFx.Props) {
	const hash = yield* HashServiceFx;
	return yield* tryGameActionFx(() => hash.gameConfig(config));
});
