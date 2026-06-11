import { useState } from "react";
import type { GameView } from "~/domains/database";
import { cellKey } from "./helpers";
import { flashMs, type DragData, type DropData } from "./types";

export function useGameFeedback() {
  const [invalidBoardCellKey, setInvalidBoardCellKey] = useState<string | null>(null);
  const [pulsedBoardCellKey, setPulsedBoardCellKey] = useState<string | null>(null);
  const [mergedBoardCellKey, setMergedBoardCellKey] = useState<string | null>(null);
  const [invalidInventorySlot, setInvalidInventorySlot] = useState<number | null>(null);
  const [pulsedInventorySlot, setPulsedInventorySlot] = useState<number | null>(null);
  function flashBoardCell(key: string | null, tone: "pulse" | "error") {
    if (!key) return;

    if (tone === "error") {
      setInvalidBoardCellKey(key);
      window.setTimeout(() => setInvalidBoardCellKey((current) => current === key ? null : current), flashMs);
      return;
    }

    setPulsedBoardCellKey(key);
    window.setTimeout(() => setPulsedBoardCellKey((current) => current === key ? null : current), flashMs);
  }

  function pulseBoardCell(key: string | null) {
    flashBoardCell(key, "pulse");
  }

  function pulseMergeCell(key: string | null) {
    if (!key) return;
    setMergedBoardCellKey(null);
    window.requestAnimationFrame(() => {
      setMergedBoardCellKey(key);
      window.setTimeout(() => setMergedBoardCellKey((current) => current === key ? null : current), 560);
    });
  }

  function flashInventorySlot(slotIndex: number | null, tone: "pulse" | "error") {
    if (slotIndex === null || slotIndex === undefined) return;

    if (tone === "error") {
      setInvalidInventorySlot(slotIndex);
      window.setTimeout(() => setInvalidInventorySlot((current) => current === slotIndex ? null : current), flashMs);
      return;
    }

    setPulsedInventorySlot(slotIndex);
    window.setTimeout(() => setPulsedInventorySlot((current) => current === slotIndex ? null : current), flashMs);
  }

  function pulseInventorySlot(slotIndex: number | null) {
    flashInventorySlot(slotIndex, "pulse");
  }

  function flashInvalidTarget(source: DragData, target: DropData, currentGame: GameView) {
    if (source.kind === "board") {
      const boardItem = currentGame.boardItemsById[source.boardItemId];
      if (boardItem) flashBoardCell(cellKey(boardItem.x, boardItem.y), "error");
    } else {
      flashInventorySlot(source.slotIndex, "error");
    }

    if (target.kind === "cell") {
      flashBoardCell(cellKey(target.x, target.y), "error");
      return;
    }

    if (target.kind === "inventory-slot") {
      flashInventorySlot(target.slotIndex, "error");
    }
  }

  function showError(error: unknown) {
    if (import.meta.env.DEV) {
      console.debug("Game action rejected", error);
    }
  }

  return {
    invalidBoardCellKey,
    pulsedBoardCellKey,
    mergedBoardCellKey,
    invalidInventorySlot,
    pulsedInventorySlot,
    flashBoardCell,
    pulseBoardCell,
    pulseMergeCell,
    flashInventorySlot,
    pulseInventorySlot,
    flashInvalidTarget,
    showError,
  };
}
