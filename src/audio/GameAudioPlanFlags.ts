import type { GameAudioSoundId } from "~/audio/GameAudioSound";

export interface GameAudioPlanFlags {
	createdItemSoundCount: number;
	playedSoundIds: Set<GameAudioSoundId>;
}

export const createGameAudioPlanFlags = (): GameAudioPlanFlags => ({
	createdItemSoundCount: 0,
	playedSoundIds: new Set<GameAudioSoundId>(),
});
