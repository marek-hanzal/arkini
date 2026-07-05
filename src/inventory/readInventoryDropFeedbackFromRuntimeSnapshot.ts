import { resolveInventoryDropFeedback } from "~/inventory/drop/resolveInventoryDropFeedback";
import type { InventoryTileEngineDragConfig } from "~/inventory/InventoryTileEngineModelTypes";
import { useGameRuntimeStore } from "~/play/runtime/GameRuntimeContext";
import { readInventoryView } from "~/play/runtime/readers/readInventoryView";

export const readInventoryDropFeedbackFromRuntimeSnapshot = ({
	context,
	runtimeStore,
}: {
	context: Parameters<NonNullable<InventoryTileEngineDragConfig["dropFeedback"]>>[0];
	runtimeStore: ReturnType<typeof useGameRuntimeStore>;
}) =>
	resolveInventoryDropFeedback({
		context,
		inventory: readInventoryView(runtimeStore.getSnapshot()),
	});
