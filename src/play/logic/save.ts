import { ensureDefaultSaveFx } from "./fx/ensureDefaultSaveFx";
import { runFx } from "./fx/runFx";

export const defaultSaveGameId = "save:default";

export function ensureDefaultSaveGame(props: ensureDefaultSaveFx.Props = {}) {
	return runFx(ensureDefaultSaveFx(props));
}
