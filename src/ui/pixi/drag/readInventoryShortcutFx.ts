import { Effect } from "effect";

import { DropItemResultKind } from "~/item-interaction/type/DropItemResult";
import type { MainActorStore } from "~/ui/pixi/actor/MainActorStore";
import type { DragPreview } from "~/ui/pixi/drag/DragPreview";
import type { ActiveDrag } from "~/ui/pixi/drag/ActiveDrag";
import type { DropSubmission } from "~/ui/pixi/drop/DropSubmission";
import type { MainSurface } from "~/ui/pixi/scene/MainSurface";

export namespace readInventoryShortcutFx {
	export interface Props {
		readonly actorStore: MainActorStore;
		readonly drag: ActiveDrag;
		readonly preview: DragPreview;
		readonly surface: MainSurface;
	}

	export type Result = Parameters<DropSubmission["submitFx"]>[0] | null;
}

/** Resolves an Inventory shortcut into exact engine submission facts without taking gesture state. */
export const readInventoryShortcutFx = Effect.fn("readInventoryShortcutFx")(function* ({
	actorStore,
	drag,
	preview,
	surface,
}: readInventoryShortcutFx.Props) {
	const inventoryActor = Array.from(actorStore.actors.values()).find(
		(actor) =>
			actor !== drag.actor &&
			!actor.container.destroyed &&
			actor.item.itemType === "inventory",
	);
	if (inventoryActor === undefined) return null;
	const pose = yield* surface.readActorPoseFx(inventoryActor.item);
	if (pose === null) return null;
	const targetFacts = yield* surface.readTargetFactsFx(
		pose.x + pose.size / 2,
		pose.y + pose.size / 2,
	);
	if (targetFacts.target === null) return null;
	const sourceItem = yield* preview.readCurrentSourceFx(drag);
	if (sourceItem === null) return null;
	const kind = yield* preview.readPreviewKindFx({
		sourceItem,
		targetFacts,
	});
	if (
		kind !== DropItemResultKind.StoreInventory ||
		targetFacts.occupant?.id !== inventoryActor.item.id
	) {
		return null;
	}
	return {
		actor: drag.actor,
		commandTarget: targetFacts.commandTarget,
		previewKind: kind,
		shortcutReceiver: {
			actor: inventoryActor,
			pose,
		},
		sourceItem,
		targetItem: targetFacts.occupant,
	} satisfies Exclude<readInventoryShortcutFx.Result, null>;
});
