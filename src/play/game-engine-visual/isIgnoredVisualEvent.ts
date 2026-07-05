import type { GameEvent } from "~/event/GameEventSchema";

const ignoredEventTypeValues = [
	"craft.completed",
	"craft.blocked",
	"craft.failed",
	"effect.activated",
	"effect.expired",
	"craft.started",
	"craft_input.withdrawn",
	"item.spawn.blocked",
	"item.spawn.failed",
	"line.default_changed",
	"cheat.speed_mode.changed",
	"item.capacity.changed",
	"item.capacity.depleted",
	"producer_input.withdrawn",
	"line.blocked",
	"line.failed",
	"line.started",
] as const satisfies readonly GameEvent["type"][];

type IgnoredVisualEventType = (typeof ignoredEventTypeValues)[number];
export type IgnoredVisualEvent = Extract<
	GameEvent,
	{
		type: IgnoredVisualEventType;
	}
>;

const ignoredEventTypes = new Set<GameEvent["type"]>(ignoredEventTypeValues);

export const isIgnoredVisualEvent = (event: GameEvent): event is IgnoredVisualEvent =>
	ignoredEventTypes.has(event.type);
