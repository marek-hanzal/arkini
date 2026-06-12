import { useCallback, useState } from "react";
import { flashMs } from "./types";

export function useGameFeedback() {
  const [invalidBoardCellKey, setInvalidBoardCellKey] = useState<string | null>(null);
  const [pulsedBoardCellKey, setPulsedBoardCellKey] = useState<string | null>(null);
  const [mergedBoardCellKey, setMergedBoardCellKey] = useState<string | null>(null);
  const [invalidInventorySlot, setInvalidInventorySlot] = useState<number | null>(null);
  const [pulsedInventorySlot, setPulsedInventorySlot] = useState<number | null>(null);

  const flashBoardCell = useCallback((key: string | null, tone: "pulse" | "error") => {
    if (!key) return;

    if (tone === "error") {
      setInvalidBoardCellKey(key);
      window.setTimeout(() => setInvalidBoardCellKey((current) => current === key ? null : current), flashMs);
      return;
    }

    setPulsedBoardCellKey(key);
    window.setTimeout(() => setPulsedBoardCellKey((current) => current === key ? null : current), flashMs);
  }, []);

  const pulseBoardCell = useCallback((key: string | null) => {
    flashBoardCell(key, "pulse");
  }, [flashBoardCell]);

  const pulseMergeCell = useCallback((key: string | null) => {
    if (!key) return;
    setMergedBoardCellKey(null);
    window.requestAnimationFrame(() => {
      setMergedBoardCellKey(key);
      window.setTimeout(() => setMergedBoardCellKey((current) => current === key ? null : current), 560);
    });
  }, []);

  const flashInventorySlot = useCallback((slotIndex: number | null, tone: "pulse" | "error") => {
    if (slotIndex === null || slotIndex === undefined) return;

    if (tone === "error") {
      setInvalidInventorySlot(slotIndex);
      window.setTimeout(() => setInvalidInventorySlot((current) => current === slotIndex ? null : current), flashMs);
      return;
    }

    setPulsedInventorySlot(slotIndex);
    window.setTimeout(() => setPulsedInventorySlot((current) => current === slotIndex ? null : current), flashMs);
  }, []);

  const pulseInventorySlot = useCallback((slotIndex: number | null) => {
    flashInventorySlot(slotIndex, "pulse");
  }, [flashInventorySlot]);

  const showError = useCallback((error: unknown) => {
    if (import.meta.env.DEV) {
      console.debug("Game action rejected", error);
    }
  }, []);

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
    showError,
  };
}
