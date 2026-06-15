import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const flashMs = 360;

type Timer = ReturnType<typeof setTimeout>;

export namespace usePlayFeedback {
	export interface State {
		invalidBoardCellKey?: string;
		mergedBoardCellKey?: string;
		imprintedBoardCellKey?: string;
		invalidInventorySlot?: number;
		flashBoardCell(key: string | undefined, tone: "error"): void;
		pulseMergeCell(key: string | undefined): void;
		pulseImprintCell(key: string | undefined): void;
		flashInventorySlot(slotIndex: number | undefined, tone: "error"): void;
		showError(error: unknown): void;
	}
}

export function usePlayFeedback(): usePlayFeedback.State {
	const [invalidBoardCellKey, setInvalidBoardCellKey] = useState<string | undefined>();
	const [mergedBoardCellKey, setMergedBoardCellKey] = useState<string | undefined>();
	const [imprintedBoardCellKey, setImprintedBoardCellKey] = useState<string | undefined>();
	const [invalidInventorySlot, setInvalidInventorySlot] = useState<number | undefined>();
	const invalidBoardTimer = useRef<Timer | undefined>(undefined);
	const mergeTimer = useRef<Timer | undefined>(undefined);
	const imprintTimer = useRef<Timer | undefined>(undefined);
	const inventoryTimer = useRef<Timer | undefined>(undefined);

	const restartTimer = useCallback((timerRef: { current: Timer | undefined }, run: () => void) => {
		if (timerRef.current) clearTimeout(timerRef.current);
		timerRef.current = setTimeout(() => {
			timerRef.current = undefined;
			run();
		}, flashMs);
	}, []);

	useEffect(
		() => () => {
			for (const timer of [
				invalidBoardTimer.current,
				mergeTimer.current,
				imprintTimer.current,
				inventoryTimer.current,
			]) {
				if (timer) clearTimeout(timer);
			}
		},
		[],
	);

	const flashBoardCell = useCallback(
		(key: string | undefined, tone: "error") => {
			if (!key || tone !== "error") return;
			setInvalidBoardCellKey(key);
			restartTimer(invalidBoardTimer, () => setInvalidBoardCellKey(undefined));
		},
		[
			restartTimer,
		],
	);

	const pulseMergeCell = useCallback(
		(key: string | undefined) => {
			if (!key) return;
			setMergedBoardCellKey(key);
			restartTimer(mergeTimer, () => setMergedBoardCellKey(undefined));
		},
		[
			restartTimer,
		],
	);

	const pulseImprintCell = useCallback(
		(key: string | undefined) => {
			if (!key) return;
			setImprintedBoardCellKey(key);
			restartTimer(imprintTimer, () => setImprintedBoardCellKey(undefined));
		},
		[
			restartTimer,
		],
	);

	const flashInventorySlot = useCallback(
		(slotIndex: number | undefined, tone: "error") => {
			if (slotIndex === undefined || tone !== "error") return;
			setInvalidInventorySlot(slotIndex);
			restartTimer(inventoryTimer, () => setInvalidInventorySlot(undefined));
		},
		[
			restartTimer,
		],
	);

	const showError = useCallback((error: unknown) => {
		if (import.meta.env.DEV) {
			console.debug("Game action rejected", error);
		}
	}, []);

	return useMemo(
		() => ({
			invalidBoardCellKey,
			mergedBoardCellKey,
			imprintedBoardCellKey,
			invalidInventorySlot,
			flashBoardCell,
			pulseMergeCell,
			pulseImprintCell,
			flashInventorySlot,
			showError,
		}),
		[
			flashBoardCell,
			flashInventorySlot,
			imprintedBoardCellKey,
			invalidBoardCellKey,
			invalidInventorySlot,
			mergedBoardCellKey,
			pulseImprintCell,
			pulseMergeCell,
			showError,
		],
	);
}
