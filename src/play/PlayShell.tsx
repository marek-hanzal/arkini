import { match } from "ts-pattern";
import { type FC, useCallback, useEffect, useMemo, useState } from "react";
import { GameAudioProvider, useGameAudio } from "~/audio/GameAudioProvider";
import { BoardSurface } from "~/board/BoardSurface";
import { CheatInventorySheet } from "~/debug/CheatInventorySheet";
import { BoardMemorySheet } from "~/debug/BoardMemorySheet";
import { NukeSaveSheet } from "~/debug/NukeSaveSheet";
import { InventorySurface } from "~/inventory/InventorySurface";
import { ItemSheet } from "~/item/ItemSheet";
import type { Feedback } from "~/play/feedback/Feedback";
import { BottomSheet } from "~/play/sheet/BottomSheet";
import type { ActiveSheetState } from "~/play/sheet/ActiveSheetState";
import { useFeedbackFlags } from "~/play/feedback/useFeedbackFlags";
import { toGameActionError } from "~/play/action/toGameActionError";
import { GameRuntimeProvider, useGameRuntimeStore } from "~/play/runtime/GameRuntimeContext";

const PlayShellContent: FC = () => {
	const audio = useGameAudio();
	const runtimeStore = useGameRuntimeStore();
	const feedbackFlags = useFeedbackFlags();
	const [activeSheet, setActiveSheet] = useState<ActiveSheetState | undefined>();
	const [lastError, setLastError] = useState<string | undefined>();
	const [memoryBusy, setMemoryBusy] = useState(false);
	useEffect(() => {
		let timeout: ReturnType<typeof globalThis.setTimeout> | undefined;
		const unsubscribe = runtimeStore.subscribeUpdate((update) => {
			if (
				!update.result.events.some(
					(event) =>
						event.type === "board.memory.saved" ||
						event.type === "board.memory.restored" ||
						event.type === "board.memory.cleared",
				)
			) {
				return;
			}

			setMemoryBusy(true);
			if (timeout !== undefined) globalThis.clearTimeout(timeout);
			timeout = globalThis.setTimeout(() => setMemoryBusy(false), 1350);
		});

		return () => {
			if (timeout !== undefined) globalThis.clearTimeout(timeout);
			unsubscribe();
		};
	}, [
		runtimeStore,
	]);
	const closeSheet = useCallback(() => {
		setActiveSheet((current) => {
			if (current) audio.play("audio.ui.sheet.close");
			return undefined;
		});
	}, [
		audio,
	]);
	const openSheet = useCallback(
		(sheet: ActiveSheetState) => {
			audio.play("audio.ui.sheet.open");
			setActiveSheet(sheet);
		},
		[
			audio,
		],
	);
	const feedback = useMemo<Feedback.Type>(
		() => ({
			pulseMergeCell() {
				// Merge is fully communicated by tile animation; no persistent cell flash.
			},
			pulseBoardCellFeedback(key, variant) {
				if (key) feedbackFlags.pulse(`board:feedback:${variant}:${key}`);
			},
			flashBoardCell(key) {
				if (!key) return;
				audio.play("audio.ui.reject.board");
				feedbackFlags.pulse(`board:error:${key}`);
			},
			flashInventorySlot(slotIndex) {
				if (slotIndex === undefined) return;
				audio.play("audio.ui.reject.inventory");
				feedbackFlags.pulse(`inventory:error:${slotIndex}`);
			},
			showError(error) {
				audio.play("audio.ui.error");
				setLastError(toGameActionError(error).message);
				feedbackFlags.pulse("toast:error");
			},
		}),
		[
			audio,
			feedbackFlags.pulse,
		],
	);

	const sheetContent = activeSheet
		? match(activeSheet)
				.with(
					{
						type: "inventory",
					},
					(sheet) => (
						<InventorySurface
							feedback={feedback}
							feedbackFlags={feedbackFlags.flags}
							onClose={closeSheet}
							placementTarget={sheet.placementTarget}
						/>
					),
				)
				.with(
					{
						type: "cheat-inventory",
					},
					() => <CheatInventorySheet onClose={closeSheet} />,
				)
				.with(
					{
						type: "nuke-save",
					},
					() => <NukeSaveSheet onClose={closeSheet} />,
				)
				.with(
					{
						type: "board-memory",
					},
					(sheet) => (
						<BoardMemorySheet
							boardItemId={sheet.boardItemId}
							onClose={closeSheet}
						/>
					),
				)
				.with(
					{
						type: "item",
					},
					(sheet) => (
						<ItemSheet
							boardItemId={sheet.boardItemId}
							onClose={closeSheet}
						/>
					),
				)
				.exhaustive()
		: null;

	return (
		<div className="relative h-dvh w-dvw overflow-hidden bg-ak-page">
			<BoardSurface
				feedback={feedback}
				feedbackFlags={feedbackFlags.flags}
				onOpenSheet={openSheet}
				disabled={Boolean(activeSheet) || memoryBusy}
			/>
			{memoryBusy ? (
				<div
					data-ui="board memory busy shield"
					className="pointer-events-auto absolute inset-0 bg-transparent"
					style={{
						zIndex: "var(--ak-layer-toast)",
					}}
				/>
			) : null}

			{lastError && feedbackFlags.has("toast:error") ? (
				<div
					data-ui="error toast"
					className="pointer-events-none absolute inset-x-3 bottom-3 mx-auto max-w-[430px] rounded-sm border border-rose-400/70 bg-rose-950/60 px-3 py-2 text-sm font-semibold text-rose-100"
					style={{
						zIndex: "var(--ak-layer-toast)",
					}}
				>
					{lastError}
				</div>
			) : null}

			<BottomSheet
				open={Boolean(activeSheet)}
				onClose={closeSheet}
			>
				{sheetContent}
			</BottomSheet>
		</div>
	);
};

export const PlayShell: FC = () => (
	<GameAudioProvider>
		<GameRuntimeProvider>
			<PlayShellContent />
		</GameRuntimeProvider>
	</GameAudioProvider>
);
