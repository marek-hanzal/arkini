import { Context } from "effect";
import type { GameConfig } from "~/v0/manifest/GameConfig";

export interface HashService {
	sha256(input: string | Uint8Array): Promise<string>;
	gameConfig(config: GameConfig): Promise<string>;
}

export class HashServiceFx extends Context.Tag("HashServiceFx")<HashServiceFx, HashService>() {
	//
}
