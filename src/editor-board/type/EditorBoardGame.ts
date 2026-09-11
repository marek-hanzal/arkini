import type { PlayableGame } from "~/playable-game/type/PlayableGame";

/** One revision-pinned, non-persistent gameplay session owned by Editor Board. */
export interface EditorBoardGame extends PlayableGame {
	readonly projectId: string;
	readonly projectRevision: number;
}
