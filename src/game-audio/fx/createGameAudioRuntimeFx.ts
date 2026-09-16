import { Effect, Random } from "effect";

import type { SoundSettings } from "~electron/contract/sound/SoundSettings";
import type { GameAudioCue } from "~/game-audio/type/GameAudioCue";
import type { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import type { PlayableGame } from "~/playable-game/type/PlayableGame";

interface MusicSlot {
	readonly audio: HTMLAudioElement;
	readonly gain: GainNode;
	resourceId?: string;
}

interface SfxSlot extends MusicSlot {
	busy: boolean;
	generation: number;
}

export namespace createGameAudioRuntimeFx {
	export interface Props {
		readonly game: Pick<PlayableGame, "getResourceUrlFn" | "resources"> & {
			readonly config: Pick<GameConfigSchema.Type, "music" | "sfx">;
		};
		readonly sound: SoundSettings;
		readonly crossfadeSeconds?: number;
		readonly maximumSfxVoices?: number;
	}

	export interface Result {
		readonly prepareFx: Effect.Effect<void, unknown, never>;
		readonly unlockFx: Effect.Effect<void, unknown, never>;
		readonly playFx: (cues: ReadonlyArray<GameAudioCue>) => Effect.Effect<void, never, never>;
		readonly playMusicFx: (resourceId: string) => Effect.Effect<void, never, never>;
		readonly setSoundFx: (sound: SoundSettings) => Effect.Effect<void, never, never>;
		readonly closeFx: Effect.Effect<void, unknown, never>;
	}
}

/** Owns one streamed Music mixer and one bounded, lazy SFX mixer for a Game route. */
export const createGameAudioRuntimeFx = Effect.fn("createGameAudioRuntimeFx")(function* ({
	game,
	sound: initialSound,
	crossfadeSeconds = 4,
	maximumSfxVoices = 8,
}: createGameAudioRuntimeFx.Props) {
	const random = yield* Random.Random;
	return yield* Effect.sync(() => {
		const packagedMusicIds = new Set(
			game.resources.filter(({ type }) => type === "music").map(({ id }) => id),
		);
		const musicIds = (game.config.music?.playlist ?? []).filter((id) =>
			packagedMusicIds.has(id),
		);
		const sfxIds = new Set(
			game.resources.filter(({ type }) => type === "sfx").map(({ id }) => id),
		);
		let sound = initialSound;
		let disposed = false;
		let unlocked = false;
		let context: AudioContext | null = null;
		let masterGain: GainNode | null = null;
		let musicGain: GainNode | null = null;
		let sfxGain: GainNode | null = null;
		let musicSlots: ReadonlyArray<MusicSlot> = [];
		let sfxSlots: ReadonlyArray<SfxSlot> = [];
		let activeMusicSlot: MusicSlot | undefined;
		let lastMusicId: string | undefined;
		let musicBag: Array<string> = [];
		let transitioning = false;
		let transitionTimer: number | undefined;
		let explicitMusic = false;
		let pendingExplicitMusicId: string | undefined;
		const failedMusic = new Set<string>();

		const applySoundFn = () => {
			if (context === null) return;
			masterGain?.gain.setValueAtTime(sound.master / 100, context.currentTime);
			musicGain?.gain.setValueAtTime(sound.music / 100, context.currentTime);
			sfxGain?.gain.setValueAtTime(sound.sfx / 100, context.currentTime);
		};

		const nextRandomMusicIdFn = () => {
			const available = musicIds.filter((id) => !failedMusic.has(id));
			if (available.length === 0) return undefined;
			if (musicBag.length === 0) {
				musicBag = [
					...(available.length > 1 && lastMusicId !== undefined
						? available.filter((id) => id !== lastMusicId)
						: available),
				];
				for (let index = musicBag.length - 1; index > 0; index -= 1) {
					const swapIndex = Math.floor(random.nextDoubleUnsafe() * (index + 1));
					const current = musicBag[index]!;
					musicBag[index] = musicBag[swapIndex]!;
					musicBag[swapIndex] = current;
				}
			}
			return musicBag.shift();
		};

		const clearSlotFn = (slot: MusicSlot) => {
			slot.audio.pause();
			slot.audio.removeAttribute("src");
			slot.audio.load();
			slot.resourceId = undefined;
		};

		let startMusicFn: (resourceId: string, explicit: boolean) => void = () => undefined;
		const startRandomMusicFn = () => {
			const resourceId = nextRandomMusicIdFn();
			if (resourceId !== undefined) startMusicFn(resourceId, false);
		};

		const createSlotFn = (activeContext: AudioContext): MusicSlot => {
			const audio = new Audio();
			audio.preload = "metadata";
			audio.crossOrigin = "anonymous";
			const source = activeContext.createMediaElementSource(audio);
			const gain = activeContext.createGain();
			gain.gain.setValueAtTime(0, activeContext.currentTime);
			source.connect(gain);
			gain.connect(musicGain!);
			const slot: MusicSlot = {
				audio,
				gain,
			};
			audio.addEventListener("timeupdate", () => {
				if (
					disposed ||
					activeMusicSlot !== slot ||
					explicitMusic ||
					transitioning ||
					!Number.isFinite(audio.duration) ||
					audio.duration - audio.currentTime > crossfadeSeconds
				)
					return;
				startRandomMusicFn();
			});
			audio.addEventListener("ended", () => {
				if (disposed || activeMusicSlot !== slot) return;
				if (transitionTimer !== undefined) window.clearTimeout(transitionTimer);
				transitionTimer = undefined;
				transitioning = false;
				explicitMusic = false;
				activeMusicSlot = undefined;
				for (const candidate of musicSlots) clearSlotFn(candidate);
				startRandomMusicFn();
			});
			audio.addEventListener("error", () => {
				if (slot.resourceId !== undefined) failedMusic.add(slot.resourceId);
				if (disposed || activeMusicSlot !== slot) return;
				transitioning = false;
				explicitMusic = false;
				startRandomMusicFn();
			});
			return slot;
		};

		const releaseSfxSlotFn = (slot: SfxSlot) => {
			if (!slot.busy) return;
			slot.busy = false;
			slot.resourceId = undefined;
			slot.audio.pause();
			slot.audio.removeAttribute("src");
			slot.audio.load();
		};

		const createSfxSlotFn = (activeContext: AudioContext): SfxSlot => {
			const audio = new Audio();
			audio.preload = "none";
			audio.crossOrigin = "anonymous";
			const source = activeContext.createMediaElementSource(audio);
			const gain = activeContext.createGain();
			source.connect(gain);
			gain.connect(sfxGain!);
			const slot: SfxSlot = {
				audio,
				gain,
				busy: false,
				generation: 0,
			};
			audio.addEventListener("ended", () => releaseSfxSlotFn(slot));
			audio.addEventListener("error", () => releaseSfxSlotFn(slot));
			return slot;
		};

		const ensureContextFn = () => {
			if (disposed || context !== null || typeof window === "undefined") return;
			const activeContext = new window.AudioContext({
				latencyHint: "interactive",
			});
			const nextMasterGain = activeContext.createGain();
			const nextMusicGain = activeContext.createGain();
			const nextSfxGain = activeContext.createGain();
			nextMusicGain.connect(nextMasterGain);
			nextSfxGain.connect(nextMasterGain);
			nextMasterGain.connect(activeContext.destination);
			context = activeContext;
			masterGain = nextMasterGain;
			musicGain = nextMusicGain;
			sfxGain = nextSfxGain;
			musicSlots = [
				createSlotFn(activeContext),
				createSlotFn(activeContext),
			];
			sfxSlots = Array.from(
				{
					length: maximumSfxVoices,
				},
				() => createSfxSlotFn(activeContext),
			);
			applySoundFn();
		};

		startMusicFn = (resourceId, explicit) => {
			const activeContext = context;
			if (disposed || !unlocked || activeContext === null || !musicIds.includes(resourceId))
				return;
			const previous = activeMusicSlot;
			const next = musicSlots.find((slot) => slot !== previous);
			if (next === undefined) return;
			if (transitionTimer !== undefined) window.clearTimeout(transitionTimer);
			clearSlotFn(next);
			next.resourceId = resourceId;
			next.audio.src = game.getResourceUrlFn(resourceId);
			next.audio.load();
			next.gain.gain.cancelScheduledValues(activeContext.currentTime);
			next.gain.gain.setValueAtTime(
				previous === undefined ? 1 : 0,
				activeContext.currentTime,
			);
			activeMusicSlot = next;
			lastMusicId = resourceId;
			explicitMusic = explicit;
			if (explicit) pendingExplicitMusicId = undefined;
			transitioning = previous !== undefined;
			void next.audio.play().then(
				() => {
					if (disposed || activeMusicSlot !== next || previous === undefined) return;
					const endAt = activeContext.currentTime + crossfadeSeconds;
					next.gain.gain.linearRampToValueAtTime(1, endAt);
					previous.gain.gain.cancelScheduledValues(activeContext.currentTime);
					previous.gain.gain.setValueAtTime(
						previous.gain.gain.value,
						activeContext.currentTime,
					);
					previous.gain.gain.linearRampToValueAtTime(0, endAt);
					transitionTimer = window.setTimeout(() => {
						clearSlotFn(previous);
						transitioning = false;
						transitionTimer = undefined;
					}, crossfadeSeconds * 1000);
				},
				() => {
					failedMusic.add(resourceId);
					if (activeMusicSlot === next) {
						transitioning = false;
						explicitMusic = false;
						startRandomMusicFn();
					}
				},
			);
		};

		const playCueFn = (cue: GameAudioCue) => {
			const activeContext = context;
			const resourceId = game.config.sfx?.events[cue.event];
			if (
				disposed ||
				!unlocked ||
				activeContext === null ||
				resourceId === undefined ||
				!sfxIds.has(resourceId)
			)
				return;
			const slot = sfxSlots.find(({ busy }) => !busy);
			if (slot === undefined) return;
			slot.busy = true;
			slot.generation += 1;
			const generation = slot.generation;
			slot.resourceId = resourceId;
			slot.gain.gain.setValueAtTime(
				Math.min(1, 0.55 + cue.strength * 0.15),
				activeContext.currentTime,
			);
			slot.audio.src = game.getResourceUrlFn(resourceId);
			slot.audio.load();
			void slot.audio.play().catch(() => {
				if (slot.generation === generation) releaseSfxSlotFn(slot);
			});
		};

		return {
			prepareFx: Effect.try({
				try: ensureContextFn,
				catch: (cause) => cause,
			}),
			unlockFx: Effect.tryPromise({
				try: async () => {
					ensureContextFn();
					if (context === null) return;
					if (context.state === "suspended") await context.resume();
					unlocked = true;
					if (activeMusicSlot === undefined) {
						if (pendingExplicitMusicId === undefined) startRandomMusicFn();
						else startMusicFn(pendingExplicitMusicId, true);
					}
				},
				catch: (cause) => cause,
			}),
			playFx: (cues) =>
				Effect.sync(() => {
					for (const cue of cues) playCueFn(cue);
				}),
			playMusicFx: (resourceId) =>
				Effect.sync(() => {
					if (!musicIds.includes(resourceId)) return;
					pendingExplicitMusicId = resourceId;
					startMusicFn(resourceId, true);
				}),
			setSoundFx: (nextSound) =>
				Effect.sync(() => {
					sound = nextSound;
					applySoundFn();
				}),
			closeFx: Effect.tryPromise({
				try: async () => {
					if (disposed) return;
					disposed = true;
					if (transitionTimer !== undefined) window.clearTimeout(transitionTimer);
					for (const slot of musicSlots) clearSlotFn(slot);
					for (const slot of sfxSlots) releaseSfxSlotFn(slot);
					musicSlots = [];
					sfxSlots = [];
					const closingContext = context;
					context = null;
					masterGain = null;
					musicGain = null;
					sfxGain = null;
					if (closingContext !== null && closingContext.state !== "closed") {
						await closingContext.close();
					}
				},
				catch: (cause) => cause,
			}),
		} satisfies createGameAudioRuntimeFx.Result;
	});
});
