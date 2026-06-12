import { useCallback, useState } from "react";
import { flashMs } from "./types";

export function useGameFeedback() {
  const [invalidBoardCellKey, setInvalidBoardCellKey] = useState<string | null>(null);
  const [mergedBoardCellKey, setMergedBoardCellKey] = useState<string | null>(null);
  const [invalidInventorySlot, setInvalidInventorySlot] = useState<number | null>(null);

  const flashBoardCell = useCallback((key: string | null, tone: "error") => {
    if (!key || tone !== "error") return;

    setInvalidBoardCellKey(key);
    window.setTimeout(() => setInvalidBoardCellKey((current) => current === key ? null : current), flashMs);
  }, []);

  const pulseMergeCell = useCallback((key: string | null) => {
    if (!key) return;
    setMergedBoardCellKey(null);
    window.requestAnimationFrame(() => {
      setMergedBoardCellKey(key);
      window.setTimeout(() => setMergedBoardCellKey((current) => current === key ? null : current), 560);
    });
  }, []);

  const flashInventorySlot = useCallback((slotIndex: number | null, tone: "error") => {
    if ((slotIndex === null || slotIndex === undefined) || tone !== "error") return;

    setInvalidInventorySlot(slotIndex);
    window.setTimeout(() => setInvalidInventorySlot((current) => current === slotIndex ? null : current), flashMs);
  }, []);

  const showError = useCallback((error: unknown) => {
    if (import.meta.env.DEV) {
      console.debug("Game action rejected", error);
    }
  }, []);

  return {
    invalidBoardCellKey,
    mergedBoardCellKey,
    invalidInventorySlot,
    flashBoardCell,
    pulseMergeCell,
    flashInventorySlot,
    showError,
  };
}
