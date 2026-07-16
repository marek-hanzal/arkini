import { z } from "zod";
import {
	GameBoardMemoryClearedEventSchema,
	GameBoardMemoryRestoredEventSchema,
	GameBoardMemorySavedEventSchema,
} from "~/event/GameBoardMemoryEventSchemas";
import { GameCheatSpeedModeChangedEventSchema } from "~/event/GameCheatEventSchemas";
import {
	GameCraftBlockedEventSchema,
	GameCraftCompletedEventSchema,
	GameCraftFailedEventSchema,
	GameCraftInputStoredEventSchema,
	GameCraftInputWithdrawnEventSchema,
	GameCraftStartedEventSchema,
} from "~/event/GameCraftEventSchemas";
import {
	GameEffectActivatedEventSchema,
	GameEffectExpiredEventSchema,
} from "~/event/GameEffectEventSchemas";
import {
	GameItemCapacityChangedEventSchema,
	GameItemCapacityDepletedEventSchema,
	GameItemConsumedEventSchema,
	GameItemCreatedEventSchema,
	GameItemRemovedEventSchema,
	GameItemReplacedEventSchema,
	GameItemSpawnBlockedEventSchema,
	GameItemSpawnFailedEventSchema,
} from "~/event/GameItemLifecycleEventSchemas";
import {
	GameLineBlockedEventSchema,
	GameLineCompletedEventSchema,
	GameLineDefaultChangedEventSchema,
	GameLineFailedEventSchema,
	GameLineStartedEventSchema,
	GameProducerInputStoredEventSchema,
	GameProducerInputWithdrawnEventSchema,
} from "~/event/GameProducerEventSchemas";

export { GameItemCreatedReasonSchema } from "~/event/GameEventBaseSchemas";

const GameEventSchema = z.discriminatedUnion("type", [
	GameItemCreatedEventSchema,
	GameItemConsumedEventSchema,
	GameItemRemovedEventSchema,
	GameItemReplacedEventSchema,
	GameProducerInputStoredEventSchema,
	GameProducerInputWithdrawnEventSchema,
	GameCraftInputStoredEventSchema,
	GameCraftInputWithdrawnEventSchema,
	GameLineStartedEventSchema,
	GameItemCapacityChangedEventSchema,
	GameItemCapacityDepletedEventSchema,
	GameEffectActivatedEventSchema,
	GameEffectExpiredEventSchema,
	GameCraftStartedEventSchema,
	GameLineCompletedEventSchema,
	GameLineBlockedEventSchema,
	GameLineFailedEventSchema,
	GameCraftCompletedEventSchema,
	GameCraftBlockedEventSchema,
	GameCraftFailedEventSchema,
	GameItemSpawnBlockedEventSchema,
	GameItemSpawnFailedEventSchema,
	GameLineDefaultChangedEventSchema,
	GameBoardMemorySavedEventSchema,
	GameBoardMemoryRestoredEventSchema,
	GameBoardMemoryClearedEventSchema,
	GameCheatSpeedModeChangedEventSchema,
]);

export type GameEvent = z.infer<typeof GameEventSchema>;
