import { Effect } from "effect";

import { DropItemResultKindEnumSchema } from "~/bridge/tile/DropItemResultKindEnumSchema";
import type { PixiMainSceneActorStore } from "~/ui/pixi/actor/PixiMainSceneActorStore";
import type { PixiMainSceneDragPreview } from "~/ui/pixi/drag/PixiMainSceneDragPreview";
import type { PixiMainSceneActiveDrag } from "~/ui/pixi/drag/PixiMainSceneDragState";
import type { PixiMainSceneDropSubmission } from "~/ui/pixi/drop/PixiMainSceneDropSubmission";
import type { PixiMainSceneSurface } from "~/ui/pixi/scene/PixiMainSceneSurface";

export namespace readPixiMainSceneInventoryShortcutFx {
	export interface Props {
		readonly actorStore: PixiMainSceneActorStore;
		readonly drag: PixiMainSceneActiveDrag;
		readonly preview: PixiMainSceneDragPreview;
		readonly surface: PixiMainSceneSurface;
	}

	export type Result = Parameters<PixiMainSceneDropSubmission["submitFx"]>[0] | null;
}

/** Resolves an Inventory shortcut into exact engine submission facts without taking gesture state. */
export const readPixiMainSceneInventoryShortcutFx = Effect.fn(
	"readPixiMainSceneInventoryShortcutFx",
)(function* ({ actorStore, drag, preview, surface }: readPixiMainSceneInventoryShortcutFx.Props) {
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
		kind !== DropItemResultKindEnumSchema.enum.StoreInventory ||
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
	} satisfies Exclude<readPixiMainSceneInventoryShortcutFx.Result, null>;
});
