import { ensureDefaultSaveFx } from "../fx/ensureDefaultSaveFx";
import { runEffect } from "./runEffect";

export const defaultSaveGameId = "save:default";

export function ensureDefaultSaveGame(props: ensureDefaultSaveFx.Props = {}) {
	return runEffect(ensureDefaultSaveFx(props));
}
