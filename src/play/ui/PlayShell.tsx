import type { FC } from "react";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import { DbStatusCard } from "~/play/ui/DbStatusCard";
import { ActionErrorPulse } from "~/play/ui/ActionErrorPulse";
import type { BuildRecipeId } from "~/manifest/data/manifestId";
import { usePlayAction } from "~/play/hook/usePlayAction";
import { usePlaySave } from "~/play/hook/usePlaySave";
import { usePlayItems } from "~/play/hook/usePlayItems";
import { Board } from "~/board/ui/Board";
import { BottomNavigation } from "~/play/ui/BottomNavigation";
import { BottomSheet } from "~/play/ui/BottomSheet";
import { BuildSheet } from "~/build/ui/BuildSheet";
import { FlyerLayer } from "~/play/ui/FlyerLayer";
import { InventorySheet } from "~/inventory/ui/InventorySheet";
import { PlayerInventorySheet } from "~/player/ui/PlayerInventorySheet";
import { SheetHeader } from "~/shared/ui/SheetHeader";
import { GameItemView } from "~/item/ui/GameItemView";
import { cellKey } from "~/board/util/cell";
import { useFlyers } from "~/play/hook/useFlyers";
import { usePlayDraggableControl } from "~/play/hook/usePlayDraggableControl";
import { usePlayFeedback } from "~/play/hook/usePlayFeedback";
import { usePlayEventQueue } from "~/play/hook/usePlayEventQueue";
import { usePlaySheets } from "~/play/hook/usePlaySheets";
import { usePlayProducerActions } from "~/play/hook/usePlayProducerActions";
import { usePlayManualItemActions } from "~/play/hook/usePlayManualItemActions";

export namespace PlayShell {
	export interface Props {}
}

export const PlayShell: FC<PlayShell.Props> = () => {
	const saveQuery = usePlaySave();
	const sheets = usePlaySheets();
	const { flyers, addFlyer, settleFlyer } = useFlyers();
	const schedulePlayEvent = usePlayEventQueue();
	const feedback = usePlayFeedback();

	const moveBoard = usePlayAction(
		(
			db,
			input: {
				boardItemId: string;
				x: number;
				y: number;
			},
		) => db.moveBoardItem(input.boardItemId, input.x, input.y),
		{
			invalidateTargets: [
				"board",
				"databaseStatus",
			],
		},
	);
	const swapInventory = usePlayAction(
		(
			db,
			input: {
				sourceSlotIndex: number;
				targetSlotIndex: number;
			},
		) => db.swapInventorySlots(input.sourceSlotIndex, input.targetSlotIndex),
		{
			invalidateTargets: [
				"inventory",
				"buildRecipes",
				"databaseStatus",
			],
		},
	);
	const mergeBoard = usePlayAction(
		(
			db,
			input: {
				sourceBoardItemId: string;
				targetBoardItemId: string;
			},
		) => db.mergeBoardItems(input.sourceBoardItemId, input.targetBoardItemId),
		{
			invalidateTargets: [
				"board",
				"databaseStatus",
			],
		},
	);
	const swapBoard = usePlayAction(
		(
			db,
			input: {
				sourceBoardItemId: string;
				targetBoardItemId: string;
			},
		) => db.swapBoardItems(input.sourceBoardItemId, input.targetBoardItemId),
		{
			invalidateTargets: [
				"board",
				"databaseStatus",
			],
		},
	);
	const build = usePlayAction(
		(
			db,
			input: {
				recipeId: BuildRecipeId;
				x: number;
				y: number;
			},
		) => db.buildRecipe(input.recipeId, input.x, input.y),
		{
			invalidateTargets: [
				"board",
				"inventory",
				"buildRecipes",
				"databaseStatus",
			],
		},
	);

	const drag = usePlayDraggableControl({
		actions: {
			moveBoard: (input) => moveBoard.mutateAsync(input),
			swapInventory: (input) => swapInventory.mutateAsync(input),
			mergeBoard: (input) => mergeBoard.mutateAsync(input),
			swapBoard: (input) => swapBoard.mutateAsync(input),
		},
		feedback,
		addFlyer,
		schedule: schedulePlayEvent,
	});
	const producerActions = usePlayProducerActions({
		activeSheet: sheets.activeSheet,
		addFlyer,
		feedback,
		schedule: schedulePlayEvent,
		hideSources: drag.hideSources,
		clearHiddenSources: drag.clearHiddenSources,
	});
	const manualActions = usePlayManualItemActions({
		addFlyer,
		feedback,
		schedule: schedulePlayEvent,
		hideSources: drag.hideSources,
		clearHiddenSources: drag.clearHiddenSources,
	});

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
				<div className="rounded-md border border-red-400/30 bg-red-950/30 p-4 text-sm text-red-100">
					{(saveQuery.error as Error)?.message ?? "Game failed to load."}
				</div>
			</div>
		);
	}

	const dragSizeVariant = drag.activeDrag?.source.kind === "inventory" ? "inventory" : "board";

	return (
		<DndContext {...drag.contextProps}>
			<div className="relative h-dvh w-dvw overflow-hidden px-3 pt-3 pb-[calc(var(--ak-bottom-nav-height)+0.75rem)]">
				<ActionErrorPulse pulseKey={feedback.actionErrorKey} />
				<main className="mx-auto flex h-full ak-game-width min-h-0 flex-col gap-3 overflow-hidden">
					<div className="shrink-0 rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2">
						<p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-emerald-300">
							Arkini
						</p>
						<h1 className="text-lg font-semibold text-slate-50">Merge board</h1>
					</div>

					<div className="min-h-0 shrink-0">
						<Board
							drag={{
								activeDrag: drag.activeDrag ?? undefined,
								isSourceHidden: drag.isSourceHidden,
							}}
							feedback={{
								invalidCellKey: feedback.invalidBoardCellKey,
								mergedCellKey: feedback.mergedBoardCellKey,
							}}
							actions={{
								emptyDoubleActivate: sheets.openBuild,
								tileSingleActivate: (item) => {
									if (item.producer)
										void producerActions.produceFrom(item, "single");
								},
								tileDoubleActivate: (item) => {
									if (item.producer?.doubleClickBehavior === "exhaust") {
										void producerActions.produceFrom(item, "exhaust");
										return;
									}

									if (!item.producer) void manualActions.stashBoardWithFly(item);
								},
							}}
						/>
					</div>
				</main>

				<BottomNavigation
					activeSheet={sheets.activeSheet}
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
							onSlotDoubleActivate={(slot) => {
								void manualActions.placeInventoryOnBoardWithFly(slot);
							}}
						/>
					</section>

					<section
						className="min-h-0"
						hidden={sheets.renderedSheet !== "player"}
					>
						<PlayerInventorySheet onClose={sheets.closeSheet} />
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
						hidden={sheets.renderedSheet !== "build"}
					>
						<BuildSheet
							cell={sheets.buildCell}
							onClose={sheets.closeSheet}
							onBuild={(recipeId) => {
								if (!sheets.buildCell) return;
								const cell = sheets.buildCell;
								void schedulePlayEvent("build recipe", async () => {
									try {
										await build.mutateAsync({
											recipeId,
											x: cell.x,
											y: cell.y,
										});
										feedback.pulseMergeCell(cellKey(cell.x, cell.y));
										sheets.closeSheet();
									} catch (error) {
										feedback.flashBoardCell(cellKey(cell.x, cell.y), "error");
										feedback.showError(error);
									}
								});
							}}
						/>
					</section>
				</div>
			</BottomSheet>

			<FlyerLayer
				flyers={flyers}
				onSettle={settleFlyer}
			/>

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
						producer={drag.activeDrag?.overlay?.producer ?? undefined}
						overlaySize={drag.dragPreviewRect ?? undefined}
					/>
				) : null}
			</DragOverlay>
		</DndContext>
	);
};
