import type { GameAudioSoundId } from "~/audio/GameAudioSound";

export namespace GameAudioPlan {
	interface Entry {
		soundId: GameAudioSoundId;
		sourceEventType?: string;
	}

	export interface Type {
		entries: Entry[];
	}
}
