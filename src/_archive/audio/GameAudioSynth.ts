import type { GameAudioSoundId } from "~/audio/GameAudioSound";

interface GameAudioSynthProps {
	context: AudioContext;
	soundId: GameAudioSoundId;
	volume: number;
}

const stopNode = (node: AudioScheduledSourceNode, at: number) => {
	try {
		node.stop(at);
	} catch {
		// Already stopped by the browser. Audio should fail silently, unlike humans.
	}
};

const createEnvelope = ({
	context,
	duration,
	volume,
}: {
	context: AudioContext;
	duration: number;
	volume: number;
}) => {
	const gain = context.createGain();
	const now = context.currentTime;
	gain.gain.cancelScheduledValues(now);
	gain.gain.setValueAtTime(0.0001, now);
	gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), now + 0.008);
	gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
	gain.connect(context.destination);
	return gain;
};

const playTone = ({
	context,
	duration,
	frequency,
	frequencyEnd,
	type = "sine",
	volume,
}: {
	context: AudioContext;
	duration: number;
	frequency: number;
	frequencyEnd?: number;
	type?: OscillatorType;
	volume: number;
}) => {
	const now = context.currentTime;
	const oscillator = context.createOscillator();
	oscillator.type = type;
	oscillator.frequency.setValueAtTime(frequency, now);
	if (frequencyEnd !== undefined) {
		oscillator.frequency.exponentialRampToValueAtTime(
			Math.max(1, frequencyEnd),
			now + duration,
		);
	}
	oscillator.connect(
		createEnvelope({
			context,
			duration,
			volume,
		}),
	);
	oscillator.start(now);
	stopNode(oscillator, now + duration + 0.02);
};

const playNoise = ({
	context,
	duration,
	filterFrequency,
	volume,
}: {
	context: AudioContext;
	duration: number;
	filterFrequency: number;
	volume: number;
}) => {
	const sampleCount = Math.max(1, Math.floor(context.sampleRate * duration));
	const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
	const channel = buffer.getChannelData(0);
	for (let index = 0; index < sampleCount; index += 1) {
		channel[index] = Math.random() * 2 - 1;
	}

	const source = context.createBufferSource();
	source.buffer = buffer;
	const filter = context.createBiquadFilter();
	filter.type = "lowpass";
	filter.frequency.value = filterFrequency;
	source.connect(filter);
	filter.connect(
		createEnvelope({
			context,
			duration,
			volume,
		}),
	);
	source.start(context.currentTime);
	stopNode(source, context.currentTime + duration + 0.02);
};

const playClick = ({ context, volume }: Omit<GameAudioSynthProps, "soundId">) => {
	playTone({
		context,
		duration: 0.055,
		frequency: 760,
		frequencyEnd: 420,
		volume,
	});
};

const playSoftPop = ({ context, volume }: Omit<GameAudioSynthProps, "soundId">) => {
	playTone({
		context,
		duration: 0.09,
		frequency: 520,
		frequencyEnd: 860,
		volume,
	});
	playTone({
		context,
		duration: 0.07,
		frequency: 980,
		frequencyEnd: 640,
		volume: volume * 0.45,
	});
};

const playLowThud = ({ context, volume }: Omit<GameAudioSynthProps, "soundId">) => {
	playTone({
		context,
		duration: 0.12,
		frequency: 120,
		frequencyEnd: 70,
		type: "triangle",
		volume,
	});
	playNoise({
		context,
		duration: 0.08,
		filterFrequency: 360,
		volume: volume * 0.35,
	});
};

const playTinyChime = ({ context, volume }: Omit<GameAudioSynthProps, "soundId">) => {
	playTone({
		context,
		duration: 0.16,
		frequency: 880,
		frequencyEnd: 1320,
		volume,
	});
	playTone({
		context,
		duration: 0.18,
		frequency: 1320,
		frequencyEnd: 1760,
		volume: volume * 0.55,
	});
};

const playRiser = ({ context, volume }: Omit<GameAudioSynthProps, "soundId">) => {
	playTone({
		context,
		duration: 0.12,
		frequency: 360,
		frequencyEnd: 960,
		volume,
	});
};

const playFaller = ({ context, volume }: Omit<GameAudioSynthProps, "soundId">) => {
	playTone({
		context,
		duration: 0.09,
		frequency: 780,
		frequencyEnd: 260,
		volume,
	});
};

const playNoiseTick = ({ context, volume }: Omit<GameAudioSynthProps, "soundId">) => {
	playNoise({
		context,
		duration: 0.09,
		filterFrequency: 900,
		volume,
	});
	playTone({
		context,
		duration: 0.055,
		frequency: 280,
		frequencyEnd: 180,
		volume: volume * 0.35,
	});
};

export const playGameAudioSynth = ({ context, soundId, volume }: GameAudioSynthProps): void => {
	if (volume <= 0) return;

	if (
		soundId === "audio.ui.error" ||
		soundId === "audio.ui.reject.board" ||
		soundId === "audio.ui.reject.inventory" ||
		soundId === "audio.tile.drop.reject" ||
		soundId === "audio.producer.blocked" ||
		soundId === "audio.producer.failed" ||
		soundId === "audio.craft.blocked" ||
		soundId === "audio.craft.failed" ||
		soundId === "audio.item.spawn.blocked" ||
		soundId === "audio.item.spawn.failed"
	) {
		playLowThud({
			context,
			volume,
		});
		return;
	}

	if (
		soundId === "audio.producer.complete" ||
		soundId === "audio.craft.complete" ||
		soundId === "audio.effect.activated"
	) {
		playTinyChime({
			context,
			volume,
		});
		return;
	}

	if (
		soundId === "audio.ui.sheet.open" ||
		soundId === "audio.craft.start" ||
		soundId === "audio.cheat.speed.enable"
	) {
		playRiser({
			context,
			volume,
		});
		return;
	}

	if (
		soundId === "audio.ui.sheet.close" ||
		soundId === "audio.effect.expired" ||
		soundId === "audio.cheat.speed.disable"
	) {
		playFaller({
			context,
			volume,
		});
		return;
	}

	if (
		soundId === "audio.tile.remove" ||
		soundId === "audio.tile.remove.output" ||
		soundId === "audio.stash.release" ||
		soundId === "audio.producer.depleted"
	) {
		playNoiseTick({
			context,
			volume,
		});
		return;
	}

	if (
		soundId === "audio.merge.success" ||
		soundId === "audio.merge.output" ||
		soundId === "audio.inventory.place" ||
		soundId === "audio.board.stash" ||
		soundId === "audio.debug.spawn.board" ||
		soundId === "audio.debug.spawn.inventory" ||
		soundId === "audio.craft.result.replace"
	) {
		playSoftPop({
			context,
			volume,
		});
		return;
	}

	playClick({
		context,
		volume,
	});
};
