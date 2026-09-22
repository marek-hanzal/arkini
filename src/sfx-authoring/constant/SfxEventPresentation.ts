import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import { PresentationSfxEventEnumSchema } from "~/sfx-event/schema/PresentationSfxEventEnumSchema";
import type { SfxEventEnumSchema } from "~/sfx-event/schema/SfxEventEnumSchema";

/** User-facing descriptions for every exact Game interaction assignable to SFX. */
export const SfxEventPresentation = [
	{
		event: GameEventEnumSchema.enum.LineInputAutofillStarted,
		group: "Job",
		label: "Autofill started",
		description: "When Autofill starts bringing materials to a production line.",
	},
	{
		event: GameEventEnumSchema.enum.ItemSwapped,
		group: "Item",
		label: "Items swapped",
		description: "When two items swap places.",
	},
	{
		event: PresentationSfxEventEnumSchema.enum.ItemDropRejected,
		group: "Item",
		label: "Item drop rejected",
		description: "When an item cannot be dropped there.",
	},
	{
		event: PresentationSfxEventEnumSchema.enum.ItemDetailOpened,
		group: "Item",
		label: "Item detail opened",
		description: "When the player opens an Item detail.",
	},
	{
		event: PresentationSfxEventEnumSchema.enum.ItemDetailClosed,
		group: "Item",
		label: "Item detail closed",
		description: "When the player closes an Item detail.",
	},
	{
		event: GameEventEnumSchema.enum.CurrentSpaceChanged,
		group: "Other",
		label: "Space changed",
		description: "When the player switches to another Board space.",
	},
	{
		event: GameEventEnumSchema.enum.JobQueued,
		group: "Job",
		label: "Job queued",
		description: "When a production request is added to a queue.",
	},
	{
		event: GameEventEnumSchema.enum.JobQueueCleared,
		group: "Job",
		label: "Queue cleared",
		description: "When the player clears an item's pending production queue.",
	},
	{
		event: GameEventEnumSchema.enum.JobStarted,
		group: "Job",
		label: "Job started",
		description: "When a production job begins.",
	},
	{
		event: GameEventEnumSchema.enum.JobCompleted,
		group: "Job",
		label: "Job completed",
		description: "When a production job finishes successfully.",
	},
	{
		event: GameEventEnumSchema.enum.JobAborted,
		group: "Job",
		label: "Job aborted",
		description: "When active production is cancelled.",
	},
	{
		event: GameEventEnumSchema.enum.ItemDiscarded,
		group: "Item",
		label: "Item discarded",
		description: "When an item cannot be delivered and is discarded.",
	},
	{
		event: GameEventEnumSchema.enum.ItemMerged,
		group: "Item",
		label: "Items merged",
		description: "When one item is applied to another.",
	},
	{
		event: GameEventEnumSchema.enum.ItemExpired,
		group: "Item",
		label: "Item expired",
		description: "When an item's Lifetime reaches zero.",
	},
	{
		event: GameEventEnumSchema.enum.ItemSpawned,
		group: "Item",
		label: "Item spawned",
		description: "When a new item is created.",
	},
	{
		event: GameEventEnumSchema.enum.ItemPlaced,
		group: "Item",
		label: "Item placed",
		description: "When an existing item is placed in a new location.",
	},
	{
		event: GameEventEnumSchema.enum.ItemConsumed,
		group: "Item",
		label: "Item consumed",
		description: "When production consumes an input.",
	},
	{
		event: GameEventEnumSchema.enum.ItemInputStored,
		group: "Item",
		label: "Input stored",
		description: "When an item is placed into a production input.",
	},
	{
		event: GameEventEnumSchema.enum.ItemUnitSpent,
		group: "Item",
		label: "Unit spent",
		description: "When an item spends one or more Units.",
	},
	{
		event: GameEventEnumSchema.enum.ItemDepleted,
		group: "Item",
		label: "Item depleted",
		description: "When an item reaches its depleted state.",
	},
	{
		event: GameEventEnumSchema.enum.ItemDisappeared,
		group: "Item",
		label: "Item disappeared",
		description: "When an item disappears without creating a replacement.",
	},
] as const satisfies ReadonlyArray<{
	readonly description: string;
	readonly group: "Item" | "Job" | "Other";
	readonly event: SfxEventEnumSchema.Type;
	readonly label: string;
}>;
