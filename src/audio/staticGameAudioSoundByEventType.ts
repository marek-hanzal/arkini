import type { GameAudioSoundId } from "~/audio/GameAudioSound";
import type { GameEvent } from "~/event/GameEventSchema";

export const staticGameAudioSoundByEventType = {
	"producer_input.stored": "audio.producer.input.store",
	"producer_input.withdrawn": "audio.producer.input.withdraw",
	"craft_input.stored": "audio.craft.input.store",
	"craft_input.withdrawn": "audio.craft.input.withdraw",
	"line.blocked": "audio.producer.blocked",
	"line.failed": "audio.producer.failed",
	"effect.activated": "audio.effect.activated",
	"effect.expired": "audio.effect.expired",
	"craft.started": "audio.craft.start",
	"craft.completed": "audio.craft.complete",
	"craft.blocked": "audio.craft.blocked",
	"craft.failed": "audio.craft.failed",
	"item.spawn.blocked": "audio.item.spawn.blocked",
	"item.spawn.failed": "audio.item.spawn.failed",
	"line.default_changed": "audio.line.default_changed",
	"item.capacity.changed": "audio.producer.input.store",
	"item.capacity.depleted": "audio.tile.remove",
} as const satisfies Partial<Record<GameEvent["type"], GameAudioSoundId>>;

export type StaticGameAudioEventType = keyof typeof staticGameAudioSoundByEventType;
export type StaticGameAudioEvent = Extract<
	GameEvent,
	{
		type: StaticGameAudioEventType;
	}
>;
export type NonStaticGameAudioEvent = Exclude<GameEvent, StaticGameAudioEvent>;
