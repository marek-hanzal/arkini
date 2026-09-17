import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import { PresentationSfxEventEnumSchema } from "~/sfx-event/schema/PresentationSfxEventEnumSchema";
import type { SfxEventEnumSchema } from "~/sfx-event/schema/SfxEventEnumSchema";

/** User-facing descriptions for every exact Game interaction assignable to SFX. */
export const SfxEventPresentation = [
	{
		event: PresentationSfxEventEnumSchema.enum.ItemDetailOpened,
		label: "Item detail opened",
		description: "When the player opens an Item detail.",
	},
	{
		event: PresentationSfxEventEnumSchema.enum.ItemDetailClosed,
		label: "Item detail closed",
		description: "When the player closes an Item detail.",
	},
	{
		event: GameEventEnumSchema.enum.CurrentSpaceChanged,
		label: "Space changed",
		description: "When the player switches to another Board space.",
	},
	{
		event: GameEventEnumSchema.enum.JobQueued,
		label: "Job queued",
		description: "When a production request is added to a queue.",
	},
	{
		event: GameEventEnumSchema.enum.JobQueueCleared,
		label: "Queue cleared",
		description: "When the player clears an item's pending production queue.",
	},
	{
		event: GameEventEnumSchema.enum.JobStarted,
		label: "Job started",
		description: "When a production job begins.",
	},
	{
		event: GameEventEnumSchema.enum.JobCompleted,
		label: "Job completed",
		description: "When a production job finishes successfully.",
	},
	{
		event: GameEventEnumSchema.enum.JobAborted,
		label: "Job aborted",
		description: "When active production is cancelled.",
	},
	{
		event: GameEventEnumSchema.enum.ItemDiscarded,
		label: "Item discarded",
		description: "When an item cannot be delivered and is discarded.",
	},
	{
		event: GameEventEnumSchema.enum.ItemMerged,
		label: "Items merged",
		description: "When one item is applied to another.",
	},
	{
		event: GameEventEnumSchema.enum.ItemExpired,
		label: "Item expired",
		description: "When an item's Lifetime reaches zero.",
	},
	{
		event: GameEventEnumSchema.enum.ItemSpawned,
		label: "Item spawned",
		description: "When a new item is created.",
	},
	{
		event: GameEventEnumSchema.enum.ItemPlaced,
		label: "Item placed",
		description: "When an existing item is placed in a new location.",
	},
	{
		event: GameEventEnumSchema.enum.ItemStacked,
		label: "Items stacked",
		description: "When matching item quantities join.",
	},
	{
		event: GameEventEnumSchema.enum.ItemSplit,
		label: "Item split",
		description: "When part of an item stack is separated.",
	},
	{
		event: GameEventEnumSchema.enum.ItemConsumed,
		label: "Item consumed",
		description: "When production consumes an input.",
	},
	{
		event: GameEventEnumSchema.enum.ItemInputStored,
		label: "Input stored",
		description: "When an item is placed into a production input.",
	},
	{
		event: GameEventEnumSchema.enum.ItemUnitSpent,
		label: "Unit spent",
		description: "When an item spends one or more Units.",
	},
	{
		event: GameEventEnumSchema.enum.ItemDepleted,
		label: "Item depleted",
		description: "When an item reaches its depleted state.",
	},
	{
		event: GameEventEnumSchema.enum.ItemDisappeared,
		label: "Item disappeared",
		description: "When an item disappears without creating a replacement.",
	},
] as const satisfies ReadonlyArray<{
	readonly description: string;
	readonly event: SfxEventEnumSchema.Type;
	readonly label: string;
}>;
