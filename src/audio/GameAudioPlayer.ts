import type { GameAudioPlan } from "~/audio/GameAudioPlan";
import type { GameAudioSoundId } from "~/audio/GameAudioSound";
import { gameAudioSoundCatalog } from "~/audio/GameAudioSound";
import { playGameAudioSynth } from "~/audio/GameAudioSynth";

export interface GameAudioPlayer {
	play(soundId: GameAudioSoundId): void;
	playPlan(plan: GameAudioPlan.Type): void;
	unlock(): void;
}

const masterVolume = 0.45;

type BrowserAudioContextConstructor = new () => AudioContext;

const readAudioContextConstructor = (): BrowserAudioContextConstructor | undefined => {
	const audioGlobal = globalThis as typeof globalThis & {
		AudioContext?: BrowserAudioContextConstructor;
		webkitAudioContext?: BrowserAudioContextConstructor;
	};

	return audioGlobal.AudioContext ?? audioGlobal.webkitAudioContext;
};

export const createGameAudioPlayer = (): GameAudioPlayer => {
	let context: AudioContext | undefined;
	let unlocked = false;
	const lastPlayedAtMsBySoundId = new Map<GameAudioSoundId, number>();

	const readContext = () => {
		if (context) return context;

		const AudioContextConstructor = readAudioContextConstructor();
		if (!AudioContextConstructor) return undefined;

		context = new AudioContextConstructor();
		return context;
	};

	const unlock = () => {
		unlocked = true;
		void readContext()
			?.resume()
			.catch(() => {
				// Browser audio unlock failed. Silence is better than crashing the game over a beep.
			});
	};

	const play = (soundId: GameAudioSoundId) => {
		if (!unlocked) return;

		const sound = gameAudioSoundCatalog[soundId];
		if (sound.volume <= 0) return;

		const nowMs = performance.now();
		const lastPlayedAtMs = lastPlayedAtMsBySoundId.get(soundId);
		if (lastPlayedAtMs !== undefined && nowMs - lastPlayedAtMs < sound.cooldownMs) return;

		const audioContext = readContext();
		if (!audioContext) return;

		lastPlayedAtMsBySoundId.set(soundId, nowMs);
		if (audioContext.state === "suspended") {
			void audioContext.resume().catch(() => undefined);
		}

		playGameAudioSynth({
			context: audioContext,
			soundId,
			volume: sound.volume * masterVolume,
		});
	};

	return {
		play,
		playPlan(plan) {
			for (const entry of plan.entries) {
				play(entry.soundId);
			}
		},
		unlock,
	};
};
