import type { GameAudioPlan } from "~/audio/GameAudioPlan";
import type { GameAudioSoundId } from "~/audio/GameAudioSound";
import type { GameConfig } from "~/config/GameConfigTypes";
import type { GameSave } from "~/engine/model/GameSaveSchema";
import type { GameEvent } from "~/event/GameEventSchema";

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

const createPlanFlags = (): PlanFlags => ({
	createdItemSoundCount: 0,
	playedSoundIds: new Set<GameAudioSoundId>(),
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

const hasEventType = <TType extends GameEvent["type"]>(
	events: readonly GameEvent[],
	type: TType,
): boolean => events.some((event) => event.type === type);

const hasEvent = (
	events: readonly GameEvent[],
	predicate: (event: GameEvent) => boolean,
): boolean => events.some(predicate);

const pushSound = ({
	flags,
	plan,
	soundId,
	sourceEventType,
}: {
	flags: PlanFlags;
	plan: GameAudioPlan.Type;
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
}: {
	flags: PlanFlags;
	plan: GameAudioPlan.Type;
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
}: {
	flags: PlanFlags;
	plan: GameAudioPlan.Type;
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

export const createGameAudioPlan = ({
	config,
	currentSave,
	events,
	previousSave,
}: createGameAudioPlan.Props): GameAudioPlan.Type => {
	const plan: GameAudioPlan.Type = {
		entries: [],
	};
	const flags = createPlanFlags();
	const hasCraftCompleted = hasEventType(events, "craft.completed");
	const hasLineCompleted = hasEventType(events, "line.completed");
	const hasMergeResult = hasEvent(
		events,
		(event) => event.type === "item.replaced" && event.reason === "merge-result",
	);
	const hasBoardStashCreated = hasEvent(
		events,
		(event) => event.type === "item.created" && event.reason === "board-stash",
	);

	for (const event of events) {
		switch (event.type) {
			case "item.created": {
				if (event.reason === "inventory-placement") {
					if (event.to.kind === "board") {
						pushCreatedItemSound({
							flags,
							plan,
							soundId: "audio.inventory.place",
							sourceEventType: event.type,
						});
					}
					break;
				}

				if (event.reason === "board-stash") {
					pushUniqueSound({
						flags,
						plan,
						soundId: "audio.board.stash",
						sourceEventType: event.type,
					});
					break;
				}

				if (event.reason === "tile-remove-output") {
					pushCreatedItemSound({
						flags,
						plan,
						soundId: "audio.tile.remove.output",
						sourceEventType: event.type,
					});
					break;
				}

				if (event.reason === "merge-output") {
					pushCreatedItemSound({
						flags,
						plan,
						soundId: "audio.merge.output",
						sourceEventType: event.type,
					});
					break;
				}

				if (event.reason === "debug") {
					pushCreatedItemSound({
						flags,
						plan,
						soundId:
							event.to.kind === "board"
								? "audio.debug.spawn.board"
								: "audio.debug.spawn.inventory",
						sourceEventType: event.type,
					});
					break;
				}

				if (event.reason === "line-output" && !hasLineCompleted) {
					pushUniqueSound({
						flags,
						plan,
						soundId: "audio.producer.complete",
						sourceEventType: event.type,
					});
				}
				break;
			}
			case "item.consumed": {
				if (event.reason === "board-stash" && !hasBoardStashCreated) {
					pushUniqueSound({
						flags,
						plan,
						soundId: "audio.board.stash",
						sourceEventType: event.type,
					});
					break;
				}

				if (event.reason === "merge-source" && hasMergeResult) break;
				break;
			}
			case "item.removed": {
				if (event.reason === "producer-depleted") {
					pushUniqueSound({
						flags,
						plan,
						soundId: "audio.producer.depleted",
						sourceEventType: event.type,
					});
					break;
				}

				if (event.reason === "tile-remove") {
					pushUniqueSound({
						flags,
						plan,
						soundId: "audio.tile.remove",
						sourceEventType: event.type,
					});
				}
				break;
			}
			case "item.replaced": {
				if (event.reason === "merge-result") {
					pushUniqueSound({
						flags,
						plan,
						soundId: "audio.merge.success",
						sourceEventType: event.type,
					});
					break;
				}

				if (event.reason === "craft-result" && !hasCraftCompleted) {
					pushUniqueSound({
						flags,
						plan,
						soundId: "audio.craft.result.replace",
						sourceEventType: event.type,
					});
				}
				break;
			}
			case "producer_input.stored":
				pushUniqueSound({
					flags,
					plan,
					soundId: "audio.producer.input.store",
					sourceEventType: event.type,
				});
				break;
			case "producer_input.withdrawn":
				pushUniqueSound({
					flags,
					plan,
					soundId: "audio.producer.input.withdraw",
					sourceEventType: event.type,
				});
				break;
			case "craft_input.stored":
				pushUniqueSound({
					flags,
					plan,
					soundId: "audio.craft.input.store",
					sourceEventType: event.type,
				});
				break;
			case "craft_input.withdrawn":
				pushUniqueSound({
					flags,
					plan,
					soundId: "audio.craft.input.withdraw",
					sourceEventType: event.type,
				});
				break;
			case "line.started":
				pushUniqueSound({
					flags,
					plan,
					soundId: isStashLineEvent({
						config,
						currentSave,
						itemInstanceId: event.itemInstanceId,
						previousSave,
					})
						? "audio.stash.open.start"
						: "audio.producer.start",
					sourceEventType: event.type,
				});
				break;
			case "line.completed":
				pushUniqueSound({
					flags,
					plan,
					soundId: isStashLineEvent({
						config,
						currentSave,
						itemInstanceId: event.itemInstanceId,
						previousSave,
					})
						? "audio.stash.release"
						: "audio.producer.complete",
					sourceEventType: event.type,
				});
				break;
			case "line.blocked":
				pushUniqueSound({
					flags,
					plan,
					soundId: "audio.producer.blocked",
					sourceEventType: event.type,
				});
				break;
			case "line.failed":
				pushUniqueSound({
					flags,
					plan,
					soundId: "audio.producer.failed",
					sourceEventType: event.type,
				});
				break;
			case "effect.activated":
				pushUniqueSound({
					flags,
					plan,
					soundId: "audio.effect.activated",
					sourceEventType: event.type,
				});
				break;
			case "effect.expired":
				pushUniqueSound({
					flags,
					plan,
					soundId: "audio.effect.expired",
					sourceEventType: event.type,
				});
				break;
			case "craft.started":
				pushUniqueSound({
					flags,
					plan,
					soundId: "audio.craft.start",
					sourceEventType: event.type,
				});
				break;
			case "craft.completed":
				pushUniqueSound({
					flags,
					plan,
					soundId: "audio.craft.complete",
					sourceEventType: event.type,
				});
				break;
			case "craft.blocked":
				pushUniqueSound({
					flags,
					plan,
					soundId: "audio.craft.blocked",
					sourceEventType: event.type,
				});
				break;
			case "craft.failed":
				pushUniqueSound({
					flags,
					plan,
					soundId: "audio.craft.failed",
					sourceEventType: event.type,
				});
				break;
			case "item.spawn.blocked":
				pushUniqueSound({
					flags,
					plan,
					soundId: "audio.item.spawn.blocked",
					sourceEventType: event.type,
				});
				break;
			case "item.spawn.failed":
				pushUniqueSound({
					flags,
					plan,
					soundId: "audio.item.spawn.failed",
					sourceEventType: event.type,
				});
				break;
			case "line.default_changed":
				pushUniqueSound({
					flags,
					plan,
					soundId: "audio.line.default_changed",
					sourceEventType: event.type,
				});
				break;
			case "board.memory.saved":
			case "board.memory.restored":
			case "board.memory.cleared":
				pushUniqueSound({
					flags,
					plan,
					soundId: "audio.effect.activated",
					sourceEventType: event.type,
				});
				break;
			case "cheat.speed_mode.changed":
				pushUniqueSound({
					flags,
					plan,
					soundId:
						event.nextMode === "instant"
							? "audio.cheat.speed.enable"
							: "audio.cheat.speed.disable",
					sourceEventType: event.type,
				});
				break;
			case "item.capacity.changed":
				pushUniqueSound({
					flags,
					plan,
					soundId: "audio.producer.input.store",
					sourceEventType: event.type,
				});
				break;
			case "item.capacity.depleted":
				pushUniqueSound({
					flags,
					plan,
					soundId: "audio.tile.remove",
					sourceEventType: event.type,
				});
				break;
			default: {
				const exhaustive: never = event;
				return exhaustive;
			}
		}
	}

	return plan;
};
