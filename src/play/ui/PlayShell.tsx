import { type FC, useCallback, useMemo } from "react";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import { DbStatusCard } from "~/play/ui/DbStatusCard";
import { HardResetButton } from "~/play/ui/HardResetButton";
import { usePlaySave } from "~/play/hook/usePlaySave";
import { Board } from "~/board/ui/Board";
import { BottomNavigation } from "~/play/ui/BottomNavigation";
import { BottomSheet } from "~/play/ui/BottomSheet";
import { InventorySheet } from "~/inventory/ui/InventorySheet";
import { UpgradesSheet } from "~/upgrade/ui/UpgradesSheet";
import { ItemDetailSheet } from "~/item/ui/ItemDetailSheet";
import { SheetHeader } from "~/shared/ui/SheetHeader";
import { GameItemView } from "~/item/ui/GameItemView";
import { usePlayDraggableControl } from "~/play/hook/usePlayDraggableControl";
import { usePlayFeedback } from "~/play/hook/usePlayFeedback";
import { usePlayEventQueue } from "~/play/hook/usePlayEventQueue";
import { usePlaySheets } from "~/play/hook/usePlaySheets";
import { usePlayProducerActions } from "~/play/hook/usePlayProducerActions";
import { usePlayManualItemActions } from "~/play/hook/usePlayManualItemActions";
import { useVisualItemMotions } from "~/play/hook/useVisualItemMotions";
import type { BoardViewItem, InventorySlot } from "~/play/logic/playTypes";

export namespace PlayShell {
	export interface Props {}
}

export const PlayShell: FC<PlayShell.Props> = () => {
	const saveQuery = usePlaySave();
	const sheets = usePlaySheets();
	const visualMotions = useVisualItemMotions();
	const schedulePlayEvent = usePlayEventQueue();
	const feedback = usePlayFeedback();

	const drag = usePlayDraggableControl({
		feedback,
		schedule: schedulePlayEvent,
		visualMotions,
	});
	const producerActions = usePlayProducerActions({
		activeSheet: sheets.activeSheet,
		visualMotions,
		feedback,
		schedule: schedulePlayEvent,
	});
	const manualActions = usePlayManualItemActions({
		visualMotions,
		feedback,
		schedule: schedulePlayEvent,
	});
	const activateBoardTile = useCallback(
		(item: BoardViewItem) => {
			if (!item.activation) return;

			void producerActions.produceFrom(
				item,
				item.activation.kind === "stash" ? "exhaust" : "single",
			);
		},
		[
			producerActions.produceFrom,
		],
	);
	const openBoardTileDetail = useCallback(
		(item: BoardViewItem) => {
			sheets.openItem(item.id);
		},
		[
			sheets.openItem,
		],
	);
	const placeInventorySlot = useCallback(
		(slot: InventorySlot) => {
			void manualActions.placeInventoryOnBoardWithFly(slot);
		},
		[
			manualActions.placeInventoryOnBoardWithFly,
		],
	);
	const boardDrag = useMemo(
		() => ({
			activeDrag: drag.activeDrag ?? undefined,
			isSourceHidden: drag.isSourceHidden,
		}),
		[
			drag.activeDrag,
			drag.isSourceHidden,
		],
	);
	const boardFeedback = useMemo(
		() => ({
			invalidCellKey: feedback.invalidBoardCellKey,
			mergedCellKey: feedback.mergedBoardCellKey,
			imprintedCellKey: feedback.imprintedBoardCellKey,
		}),
		[
			feedback.imprintedBoardCellKey,
			feedback.invalidBoardCellKey,
			feedback.mergedBoardCellKey,
		],
	);
	const boardActions = useMemo(
		() => ({
			tileSingleActivate: activateBoardTile,
			tileLongActivate: openBoardTileDetail,
		}),
		[
			activateBoardTile,
			openBoardTileDetail,
		],
	);

	if (saveQuery.isPending) {
		return (
			<div className="grid h-dvh w-dvw place-items-center text-sm text-slate-400">
				Booting SQLite…
			</div>
		);
	}

	if (saveQuery.isError || !saveQuery.data) {
		return (
			<div className="grid h-dvh w-dvw place-items-center p-4">
				<div className="w-full max-w-xl rounded-md border border-red-400/30 bg-red-950/30 p-4 text-sm text-red-100">
					<p>{(saveQuery.error as Error)?.message ?? "Game failed to load."}</p>
					<div className="mt-4">
						<HardResetButton />
					</div>
				</div>
			</div>
		);
	}

	const dragSizeVariant = drag.activeDrag?.source.kind === "inventory" ? "inventory" : "board";

	return (
		<DndContext {...drag.contextProps}>
			<div className="relative h-dvh w-dvw overflow-hidden px-3 pt-3 pb-[calc(var(--ak-bottom-nav-height)+0.75rem)]">
				<main className="mx-auto flex h-full ak-game-width min-h-0 flex-col gap-3 overflow-hidden">
					<div className="shrink-0 rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2">
						<p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-emerald-300">
							Arkini
						</p>
						<h1 className="text-lg font-semibold text-slate-50">Merge board</h1>
					</div>

					<div className="min-h-0 shrink-0">
						<Board
							drag={boardDrag}
							feedback={boardFeedback}
							actions={boardActions}
							visualMotions={visualMotions}
						/>
					</div>
				</main>

				<BottomNavigation
					activeSheet={sheets.activeSheet}
					inventoryDropTargetActive={drag.activeDrag?.source.kind === "board"}
					onOpen={sheets.openSheet}
				/>
			</div>

			<BottomSheet
				open={sheets.activeSheet !== undefined}
				onClose={sheets.closeSheet}
			>
				<div className="min-h-0">
					<section
						className="min-h-0"
						hidden={sheets.renderedSheet !== "inventory"}
					>
						<InventorySheet
							isSourceHidden={drag.isSourceHidden}
							invalidInventorySlot={feedback.invalidInventorySlot}
							onClose={sheets.closeSheet}
							onSlotDoubleActivate={placeInventorySlot}
							visualMotions={visualMotions}
						/>
					</section>

					<section
						className="min-h-0"
						hidden={sheets.renderedSheet !== "upgrades"}
					>
						<UpgradesSheet onClose={sheets.closeSheet} />
					</section>

					<section
						className="max-h-[var(--ak-sheet-max-height)] overflow-y-auto overscroll-contain"
						hidden={sheets.renderedSheet !== "database"}
					>
						<SheetHeader
							eyebrow="System"
							description="Local database"
							onClose={sheets.closeSheet}
						/>
						<div className="p-4 pt-1">
							<DbStatusCard />
						</div>
					</section>

					<section
						className="max-h-[var(--ak-sheet-max-height)] overflow-y-auto overscroll-contain"
						hidden={sheets.renderedSheet !== "item"}
					>
						<ItemDetailSheet
							boardItemId={sheets.selectedBoardItemId}
							onClose={sheets.closeSheet}
						/>
					</section>
				</div>
			</BottomSheet>

			<DragOverlay
				adjustScale={false}
				dropAnimation={null}
			>
				{drag.activeItem ? (
					<GameItemView
						item={drag.activeItem}
						variant="drag"
						sizeVariant={dragSizeVariant}
						quantity={drag.activeDrag?.overlay?.quantity}
						activation={drag.activeDrag?.overlay?.activation ?? undefined}
						overlaySize={drag.dragPreviewRect ?? undefined}
					/>
				) : null}
			</DragOverlay>
		</DndContext>
	);
};
