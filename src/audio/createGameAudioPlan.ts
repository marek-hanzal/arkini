import { match } from "ts-pattern";
import type { GameAudioPlan } from "~/audio/GameAudioPlan";
import type { GameAudioSoundId } from "~/audio/GameAudioSound";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";
import type { GameEventOfType } from "~/event/GameEventOfType";

const maxCreatedItemSoundsPerPlan = 3;

export namespace createGameAudioPlan {
	export interface Props {
		config: GameConfig;
		currentSave: GameSave;
		events: readonly GameEvent[];
		previousSave: GameSave;
	}
}

type PlanFlags = {
	createdItemSoundCount: number;
	playedSoundIds: Set<GameAudioSoundId>;
};

type AudioPlanWriter = {
	flags: PlanFlags;
	plan: GameAudioPlan.Type;
};

type AudioBatchFacts = {
	hasBoardStashCreated: boolean;
	hasCraftCompleted: boolean;
	hasLineCompleted: boolean;
	hasMergeResult: boolean;
};

type AudioPlanContext = createGameAudioPlan.Props & AudioPlanWriter & AudioBatchFacts;

const staticSoundByEventType = {
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

type StaticAudioEventType = keyof typeof staticSoundByEventType;
type StaticAudioEvent = Extract<
	GameEvent,
	{
		type: StaticAudioEventType;
	}
>;
type NonStaticAudioEvent = Exclude<GameEvent, StaticAudioEvent>;

const createPlanFlags = (): PlanFlags => ({
	createdItemSoundCount: 0,
	playedSoundIds: new Set<GameAudioSoundId>(),
});

const readAudioBatchFacts = (events: readonly GameEvent[]): AudioBatchFacts => ({
	hasCraftCompleted: events.some((event) => event.type === "craft.completed"),
	hasLineCompleted: events.some((event) => event.type === "line.completed"),
	hasMergeResult: events.some(
		(event) => event.type === "item.replaced" && event.reason === "merge-result",
	),
	hasBoardStashCreated: events.some(
		(event) => event.type === "item.created" && event.reason === "board-stash",
	),
});

const readBoardItemId = ({
	currentSave,
	itemInstanceId,
	previousSave,
}: {
	currentSave: GameSave;
	itemInstanceId: string;
	previousSave: GameSave;
}) =>
	currentSave.board.items[itemInstanceId]?.itemId ??
	previousSave.board.items[itemInstanceId]?.itemId;

const isStashLineEvent = ({
	config,
	currentSave,
	itemInstanceId,
	previousSave,
}: {
	config: GameConfig;
	currentSave: GameSave;
	itemInstanceId: string;
	previousSave: GameSave;
}) => {
	const itemId = readBoardItemId({
		currentSave,
		itemInstanceId,
		previousSave,
	});
	if (!itemId) return false;

	return Boolean(config.items[itemId]?.stash);
};

const pushSound = ({
	flags,
	plan,
	soundId,
	sourceEventType,
}: AudioPlanWriter & {
	soundId: GameAudioSoundId;
	sourceEventType: string;
}) => {
	plan.entries.push({
		soundId,
		sourceEventType,
	});
	flags.playedSoundIds.add(soundId);
};

const pushUniqueSound = ({
	flags,
	plan,
	soundId,
	sourceEventType,
}: AudioPlanWriter & {
	soundId: GameAudioSoundId;
	sourceEventType: string;
}) => {
	if (flags.playedSoundIds.has(soundId)) return;
	pushSound({
		flags,
		plan,
		soundId,
		sourceEventType,
	});
};

const pushCreatedItemSound = ({
	flags,
	plan,
	soundId,
	sourceEventType,
}: AudioPlanWriter & {
	soundId: GameAudioSoundId;
	sourceEventType: string;
}) => {
	if (flags.createdItemSoundCount >= maxCreatedItemSoundsPerPlan) return;
	flags.createdItemSoundCount += 1;
	pushSound({
		flags,
		plan,
		soundId,
		sourceEventType,
	});
};

const pushItemCreatedAudio = (context: AudioPlanContext, event: GameEventOfType<"item.created">) =>
	match(event.reason)
		.with("inventory-placement", () => {
			if (event.to.kind !== "board") return;
			pushCreatedItemSound({
				...context,
				soundId: "audio.inventory.place",
				sourceEventType: event.type,
			});
		})
		.with("board-stash", () =>
			pushUniqueSound({
				...context,
				soundId: "audio.board.stash",
				sourceEventType: event.type,
			}),
		)
		.with("tile-remove-output", () =>
			pushCreatedItemSound({
				...context,
				soundId: "audio.tile.remove.output",
				sourceEventType: event.type,
			}),
		)
		.with("merge-output", () =>
			pushCreatedItemSound({
				...context,
				soundId: "audio.merge.output",
				sourceEventType: event.type,
			}),
		)
		.with("debug", () =>
			pushCreatedItemSound({
				...context,
				soundId:
					event.to.kind === "board"
						? "audio.debug.spawn.board"
						: "audio.debug.spawn.inventory",
				sourceEventType: event.type,
			}),
		)
		.with("line-output", () => {
			if (context.hasLineCompleted) return;
			pushUniqueSound({
				...context,
				soundId: "audio.producer.complete",
				sourceEventType: event.type,
			});
		})
		.with(
			"producer-input-withdraw",
			"craft-input-withdraw",
			"memory-restore",
			"memory-store",
			() => undefined,
		)
		.exhaustive();

const pushItemConsumedAudio = (
	context: AudioPlanContext,
	event: GameEventOfType<"item.consumed">,
) =>
	match(event.reason)
		.with("board-stash", () => {
			if (context.hasBoardStashCreated) return;
			pushUniqueSound({
				...context,
				soundId: "audio.board.stash",
				sourceEventType: event.type,
			});
		})
		.with("merge-source", () => undefined)
		.with(
			"line-input",
			"producer-input-store",
			"producer-input-auto-fill",
			"craft-input",
			"craft-input-store",
			"craft-input-auto-fill",
			"inventory-placement",
			"remove-tool",
			"memory-restore",
			"memory-store",
			() => undefined,
		)
		.exhaustive();

const pushItemRemovedAudio = (context: AudioPlanContext, event: GameEventOfType<"item.removed">) =>
	match(event.reason)
		.with("producer-depleted", () =>
			pushUniqueSound({
				...context,
				soundId: "audio.producer.depleted",
				sourceEventType: event.type,
			}),
		)
		.with("tile-remove", () =>
			pushUniqueSound({
				...context,
				soundId: "audio.tile.remove",
				sourceEventType: event.type,
			}),
		)
		.with("debug-delete", "capacity-depleted", "merge-result", "craft-result", () => undefined)
		.exhaustive();

const pushItemReplacedAudio = (
	context: AudioPlanContext,
	event: GameEventOfType<"item.replaced">,
) =>
	match(event.reason)
		.with("merge-result", () =>
			pushUniqueSound({
				...context,
				soundId: "audio.merge.success",
				sourceEventType: event.type,
			}),
		)
		.with("craft-result", () => {
			if (context.hasCraftCompleted) return;
			pushUniqueSound({
				...context,
				soundId: "audio.craft.result.replace",
				sourceEventType: event.type,
			});
		})
		.with(
			"debug-delete",
			"capacity-depleted",
			"producer-depleted",
			"tile-remove",
			() => undefined,
		)
		.exhaustive();

const readLineEventSoundId = (
	context: AudioPlanContext,
	event: GameEventOfType<"line.started" | "line.completed">,
): GameAudioSoundId =>
	match(event.type)
		.with("line.started", () =>
			isStashLineEvent({
				...context,
				itemInstanceId: event.itemInstanceId,
			})
				? "audio.stash.open.start"
				: "audio.producer.start",
		)
		.with("line.completed", () =>
			isStashLineEvent({
				...context,
				itemInstanceId: event.itemInstanceId,
			})
				? "audio.stash.release"
				: "audio.producer.complete",
		)
		.exhaustive();

const pushLineLifecycleAudio = (
	context: AudioPlanContext,
	event: GameEventOfType<"line.started" | "line.completed">,
) =>
	pushUniqueSound({
		...context,
		soundId: readLineEventSoundId(context, event),
		sourceEventType: event.type,
	});

const pushMemoryAudio = (
	context: AudioPlanContext,
	event: GameEventOfType<"board.memory.saved" | "board.memory.restored" | "board.memory.cleared">,
) =>
	pushUniqueSound({
		...context,
		soundId: "audio.effect.activated",
		sourceEventType: event.type,
	});

const pushCheatSpeedAudio = (
	context: AudioPlanContext,
	event: GameEventOfType<"cheat.speed_mode.changed">,
) =>
	pushUniqueSound({
		...context,
		soundId: match(event.nextMode)
			.with("instant", () => "audio.cheat.speed.enable" as const)
			.with("normal", () => "audio.cheat.speed.disable" as const)
			.exhaustive(),
		sourceEventType: event.type,
	});

const isStaticAudioEvent = (event: GameEvent): event is StaticAudioEvent =>
	event.type in staticSoundByEventType;

const pushStaticAudioEvent = (context: AudioPlanContext, event: StaticAudioEvent) =>
	pushUniqueSound({
		...context,
		soundId: staticSoundByEventType[event.type],
		sourceEventType: event.type,
	});

const pushNonStaticAudioEvent = (context: AudioPlanContext, event: NonStaticAudioEvent) =>
	match(event)
		.with(
			{
				type: "item.created",
			},
			(matchedEvent) => pushItemCreatedAudio(context, matchedEvent),
		)
		.with(
			{
				type: "item.consumed",
			},
			(matchedEvent) => pushItemConsumedAudio(context, matchedEvent),
		)
		.with(
			{
				type: "item.removed",
			},
			(matchedEvent) => pushItemRemovedAudio(context, matchedEvent),
		)
		.with(
			{
				type: "item.replaced",
			},
			(matchedEvent) => pushItemReplacedAudio(context, matchedEvent),
		)
		.with(
			{
				type: "line.started",
			},
			(matchedEvent) => pushLineLifecycleAudio(context, matchedEvent),
		)
		.with(
			{
				type: "line.completed",
			},
			(matchedEvent) => pushLineLifecycleAudio(context, matchedEvent),
		)
		.with(
			{
				type: "board.memory.saved",
			},
			(matchedEvent) => pushMemoryAudio(context, matchedEvent),
		)
		.with(
			{
				type: "board.memory.restored",
			},
			(matchedEvent) => pushMemoryAudio(context, matchedEvent),
		)
		.with(
			{
				type: "board.memory.cleared",
			},
			(matchedEvent) => pushMemoryAudio(context, matchedEvent),
		)
		.with(
			{
				type: "cheat.speed_mode.changed",
			},
			(matchedEvent) => pushCheatSpeedAudio(context, matchedEvent),
		)
		.exhaustive();

const pushAudioEvent = (context: AudioPlanContext, event: GameEvent) => {
	if (isStaticAudioEvent(event)) {
		pushStaticAudioEvent(context, event);
		return;
	}

	pushNonStaticAudioEvent(context, event);
};

export const createGameAudioPlan = (props: createGameAudioPlan.Props): GameAudioPlan.Type => {
	const context: AudioPlanContext = {
		...props,
		...readAudioBatchFacts(props.events),
		flags: createPlanFlags(),
		plan: {
			entries: [],
		},
	};

	for (const event of props.events) {
		pushAudioEvent(context, event);
	}

	return context.plan;
};
