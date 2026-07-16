import { loadGameConfigPackFromUrl } from "~/config/pack/loadGameConfigPackFromUrl";

const defaultGamePackUrl = new URL("../../../game/arkini.game.arkpack", import.meta.url);
let defaultGameConfigPromise: ReturnType<typeof loadGameConfigPackFromUrl> | undefined;

export const loadDefaultGameConfig = () => {
	defaultGameConfigPromise ??= loadGameConfigPackFromUrl(defaultGamePackUrl);
	return defaultGameConfigPromise;
};
