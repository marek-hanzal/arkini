import type { GameEvent } from "~/event/GameEventSchema";
import {
	staticGameAudioSoundByEventType,
	type StaticGameAudioEvent,
} from "~/audio/staticGameAudioSoundByEventType";

export const isStaticGameAudioEvent = (event: GameEvent): event is StaticGameAudioEvent =>
	event.type in staticGameAudioSoundByEventType;
