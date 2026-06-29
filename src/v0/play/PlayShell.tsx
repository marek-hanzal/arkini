import { match } from "ts-pattern";
import { type FC, useCallback, useEffect, useMemo, useState } from "react";
import { BoardSurface } from "~/v0/board/BoardSurface";
import { CheatInventorySheet } from "~/v0/debug/CheatInventorySheet";
import { NukeSaveSheet } from "~/v0/debug/NukeSaveSheet";
import { registerDebugBugReport } from "~/v0/debug/DebugBugReport";
import { InventorySurface } from "~/v0/inventory/InventorySurface";
import { ItemSheet } from "~/v0/item/ItemSheet";
import type { Feedback } from "~/v0/play/feedback/Feedback";
import { BottomSheet } from "~/v0/play/sheet/BottomSheet";
import type { ActiveSheetState } from "~/v0/play/sheet/ActiveSheetState";
import { useFeedbackFlags } from "~/v0/play/feedback/useFeedbackFlags";
import { toGameActionError } from "~/v0/play/action/toGameActionError";
import { GameRuntimeProvider, useGameRuntimeStore } from "~/v0/play/runtime";

const PlayShellContent: FC = () => {
	const runtimeStore = useGameRuntimeStore();
	const feedbackFlags = useFeedbackFlags();
	const [activeSheet, setActiveSheet] = useState<ActiveSheetState | undefined>();
	const [lastError, setLastError] = useState<string | undefined>();
	const closeSheet = useCallback(() => setActiveSheet(undefined), []);
	const openSheet = useCallback((sheet: ActiveSheetState) => setActiveSheet(sheet), []);
	const feedback = useMemo<Feedback.Type>(
		() => ({
			pulseMergeCell() {
				// Merge is fully communicated by tile animation; no persistent cell flash.
			},
			pulseBoardCellFeedback(key, variant) {
				if (key) feedbackFlags.pulse(`board:feedback:${variant}:${key}`);
			},
			flashBoardCell(key) {
				if (key) feedbackFlags.pulse(`board:error:${key}`);
			},
			flashInventorySlot(slotIndex) {
				if (slotIndex !== undefined) feedbackFlags.pulse(`inventory:error:${slotIndex}`);
			},
			showError(error) {
				setLastError(toGameActionError(error).message);
				feedbackFlags.pulse("toast:error");
			},
		}),
		[
			feedbackFlags.pulse,
		],
	);

	useEffect(() => {
		registerDebugBugReport({
			getContext: () => {
				const runtime = runtimeStore.getSnapshot();
				return {
					activeSheet: activeSheet?.type,
					lastError,
					runtime: {
						boardItems: Object.keys(runtime.runtime.save.board.items).length,
						inventoryStacks:
							runtime.runtime.save.inventory.slots.filter(Boolean).length,
						nextWakeAtMs: runtime.runtime.nextWakeAtMs,
						revision: runtime.revision,
					},
				};
			},
		});
	}, [
		activeSheet?.type,
		lastError,
		runtimeStore,
	]);

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
				disabled={Boolean(activeSheet)}
			/>

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
	<GameRuntimeProvider>
		<PlayShellContent />
	</GameRuntimeProvider>
);
