import { match } from "ts-pattern";
import { type FC, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BoardSurface } from "~/v0/board/BoardSurface";
import { CheatInventorySheet } from "~/v0/debug/CheatInventorySheet";
import { DevSheet } from "~/v0/debug/DevSheet";
import { registerDebugBugReport } from "~/v0/debug/DebugBugReport";
import { InventorySurface } from "~/v0/inventory/InventorySurface";
import { ItemSheet } from "~/v0/item/ItemSheet";
import type { Feedback } from "~/v0/play/feedback/Feedback";
import { BottomNav } from "~/v0/play/BottomNav";
import { BottomSheet } from "~/v0/play/sheet/BottomSheet";
import type { ActiveSheetState } from "~/v0/play/sheet/ActiveSheetState";
import type { Sheet } from "~/v0/play/sheet/Sheet";
import { useFeedbackFlags } from "~/v0/play/feedback/useFeedbackFlags";
import { UpgradesSheet } from "~/v0/upgrade/UpgradesSheet";
import { toGameActionError } from "~/v0/play/action/toGameActionError";
import { GameRuntimeProvider, useGameRuntimeStore } from "~/v0/play/runtime";

export namespace PlayShell {
	export interface Props {}
}

const SheetFallback: FC = () => (
	<div className="p-4 text-sm text-ak-text-muted">Loading sheet…</div>
);

const PlayShellContent: FC = () => {
	const runtimeStore = useGameRuntimeStore();
	const feedbackFlags = useFeedbackFlags();
	const playAreaRef = useRef<HTMLDivElement | null>(null);
	const [activeSheet, setActiveSheet] = useState<ActiveSheetState | undefined>();
	const [lastError, setLastError] = useState<string | undefined>();
	const closeSheet = useCallback(() => setActiveSheet(undefined), []);
	const openSheet = useCallback(
		(sheet: Sheet) =>
			setActiveSheet({
				type: sheet,
			}),
		[],
	);
	const openItem = useCallback(
		(boardItemId: string) =>
			setActiveSheet({
				type: "item",
				boardItemId,
			}),
		[],
	);
	const openInventoryPlacementTarget = useCallback(
		(placementTarget: { x: number; y: number }) =>
			setActiveSheet({
				type: "inventory",
				placementTarget,
			}),
		[],
	);
	const feedback = useMemo<Feedback.Type>(
		() => ({
			pulseMergeCell() {
				// Merge is fully communicated by tile animation; no persistent cell flash.
			},
			pulseImprintCell() {
				// Directed merge/imprint uses the same animation-only feedback path.
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
						type: "upgrades",
					},
					() => <UpgradesSheet onClose={closeSheet} />,
				)
				.with(
					{
						type: "cheat-inventory",
					},
					() => <CheatInventorySheet onClose={closeSheet} />,
				)
				.with(
					{
						type: "dev",
					},
					() => <DevSheet onClose={closeSheet} />,
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
		<div
			ref={playAreaRef}
			data-ui="app root"
			className="relative h-dvh w-dvw overflow-hidden"
		>
			<div
				data-ui="game screen"
				className="relative h-full w-full overflow-hidden bg-ak-page pb-[calc(var(--ak-bottom-nav-height)+0.55rem)]"
			>
				<main
					data-ui="play layout"
					className="flex h-full w-full min-h-0 flex-col overflow-hidden"
				>
					<div
						data-ui="game board area"
						className="min-h-0 flex-1 overflow-hidden"
					>
						<BoardSurface
							feedback={feedback}
							feedbackFlags={feedbackFlags.flags}
							onOpenInventoryPlacementTarget={openInventoryPlacementTarget}
							onOpenItem={openItem}
							disabled={Boolean(activeSheet)}
						/>
					</div>
				</main>

				{lastError && feedbackFlags.has("toast:error") ? (
					<div
						data-ui="error toast"
						className="pointer-events-none absolute inset-x-3 bottom-[calc(var(--ak-bottom-nav-height)+0.85rem)] mx-auto max-w-[430px] rounded-sm border border-rose-400/70 bg-rose-950/60 px-3 py-2 text-sm font-semibold text-rose-100"
						style={{
							zIndex: "var(--ak-layer-toast)",
						}}
					>
						{lastError}
					</div>
				) : null}

				<BottomNav
					activeSheet={activeSheet?.type}
					onOpen={openSheet}
				/>
			</div>

			<BottomSheet
				open={Boolean(activeSheet)}
				onClose={closeSheet}
			>
				<Suspense fallback={<SheetFallback />}>{sheetContent}</Suspense>
			</BottomSheet>
		</div>
	);
};

export const PlayShell: FC<PlayShell.Props> = () => (
	<GameRuntimeProvider>
		<PlayShellContent />
	</GameRuntimeProvider>
);
