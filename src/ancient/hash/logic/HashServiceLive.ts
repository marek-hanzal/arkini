import type { HashService } from "~/hash/context/HashServiceFx";
import { normalizeGameConfig } from "./normalizeGameConfig";
import { sha256 } from "./sha256";

export const HashServiceLive: HashService = {
	sha256,
	gameConfig(config) {
		return sha256(normalizeGameConfig(config));
	},
};
