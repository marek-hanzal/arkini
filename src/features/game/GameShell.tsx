import { DndContext, DragOverlay, pointerWithin } from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import { Toaster } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { DbStatusCard } from "~/components/DbStatusCard";
import { ActionPanel } from "~/features/game/components/ActionPanel";
import { BuildModal } from "~/features/game/components/BuildModal";
import { BoardPanel } from "~/features/game/components/BoardPanel";
import { DragPreview } from "~/features/game/components/DragPreview";
import { FlyoutTile } from "~/features/game/components/FlyoutTile";
import { GameCard } from "~/features/game/components/GameCard";
import { InventoryPanel } from "~/features/game/components/InventoryPanel";
import { SplashScreen } from "~/features/game/components/SplashScreen";
import { invalidDropReturnMs } from "~/features/game/components/constants";
import { getInventoryPreviewSlot } from "~/features/game/components/helpers/getInventoryPreviewSlot";
import { isMergeOverlayFaded } from "~/features/game/components/helpers/isMergeOverlayFaded";
import { useCooldownClock } from "~/features/game/hooks/useCooldownClock";
import { useGameInteractions } from "~/features/game/hooks/useGameInteractions";
import { useSplashDelay } from "~/features/game/hooks/useSplashDelay";
import { useGameUiStore } from "~/features/game/state/gameUiStore";
import { useGameView } from "~/hooks/useGameView";

export function GameShell() {
  const game = useGameView();
  const ui = useGameUiStore(
    useShallow((state) => ({
      selection: state.selection,
      activeDrag: state.activeDrag,
      activeOverId: state.activeOverId,
      committedDrag: state.committedDrag,
      returningDrag: state.returningDrag,
      invalidTargetId: state.invalidTargetId,
      inventoryPulseSlot: state.inventoryPulseSlot,
      boardPulseCell: state.boardPulseCell,
      mergePulseBoardItemId: state.mergePulseBoardItemId,
      flyout: state.flyout,
      hiddenBoardItemIds: state.hiddenBoardItemIds,
      buildCell: state.buildCell,
      splashReady: state.splashReady,
      setSelection: state.setSelection,
      setBuildCell: state.setBuildCell,
    })),
  );

  useSplashDelay(1500);
  useCooldownClock(150);

  const interactions = useGameInteractions(game.data);

  if (game.isLoading || !ui.splashReady) {
    return <SplashScreen />;
  }

  if (game.isError) {
    return <GameCard title="Game failed">{(game.error as Error).message}</GameCard>;
  }

  if (!game.data) return null;

  const hiddenDrag = ui.committedDrag ?? ui.returningDrag;
  const inventoryPreviewSlot = getInventoryPreviewSlot(game.data, ui.activeDrag, ui.activeOverId, Date.now());
  const overlayFaded = isMergeOverlayFaded(game.data, ui.activeDrag, ui.activeOverId);

  return (
    <>
      <Toaster
        richColors
        position="top-right"
        toastOptions={{
          classNames: {
            toast: "border border-slate-700 bg-slate-950 text-slate-100 shadow-2xl shadow-slate-950/60",
            error: "border-red-400/40 bg-red-950 text-red-50",
          },
        }}
      />
      <DndContext
        sensors={interactions.sensors}
        collisionDetection={pointerWithin}
        onDragStart={interactions.handleDragStart}
        onDragOver={interactions.handleDragOver}
        onDragCancel={interactions.handleDragCancel}
        onDragEnd={interactions.handleDragEnd}
      >
        <section className="flex w-fit max-w-full flex-col gap-3">
          <div className="flex w-fit max-w-full items-start gap-3 overflow-x-auto pb-1">
            <BoardPanel
              game={game.data}
              selection={ui.selection}
              activeDrag={ui.activeDrag}
              pending={interactions.pending}
              invalidTargetId={ui.invalidTargetId}
              committedDrag={hiddenDrag}
              hiddenBoardItemIds={ui.hiddenBoardItemIds}
              mergePulseBoardItemId={ui.mergePulseBoardItemId}
              boardPulseCell={ui.boardPulseCell}
              onSelect={ui.setSelection}
              onProduce={interactions.handleProduce}
              onStash={interactions.handleStash}
              onOpenBuild={ui.setBuildCell}
            />
            <InventoryPanel
              game={game.data}
              pending={interactions.pending}
              invalidTargetId={ui.invalidTargetId}
              committedDrag={hiddenDrag}
              previewSlotIndex={inventoryPreviewSlot}
              pulseSlotIndex={ui.inventoryPulseSlot}
              onPlaceStack={interactions.handlePlaceStack}
            />
          </div>

          <div className="grid w-full gap-3 xl:grid-cols-[minmax(18rem,24rem)_1fr]">
            <ActionPanel game={game.data} selection={ui.selection} pending={interactions.pending} invalidTargetId={ui.invalidTargetId} />
            <DbStatusCard />
          </div>
        </section>
        <DragOverlay
          dropAnimation={
            ui.committedDrag ? null : { duration: invalidDropReturnMs, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
          }
          modifiers={[snapCenterToCursor]}
        >
          {ui.activeDrag ? <DragPreview game={game.data} drag={ui.activeDrag} faded={overlayFaded} /> : null}
        </DragOverlay>
      </DndContext>
      <BuildModal
        game={game.data}
        cell={ui.buildCell}
        pending={interactions.pending}
        onClose={interactions.handleCloseBuild}
        onBuild={interactions.handleBuild}
      />
      {ui.flyout ? <FlyoutTile game={game.data} flyout={ui.flyout} /> : null}
    </>
  );
}
