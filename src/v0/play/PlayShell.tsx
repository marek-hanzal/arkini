import { match } from "ts-pattern";
import { type FC, Suspense, useCallback, useMemo, useState } from "react";
import { BoardSurface } from "~/v0/board/BoardSurface";
import { DatabaseSheet } from "~/v0/database/DatabaseSheet";
import { InventorySurface } from "~/v0/inventory/InventorySurface";
import { ItemSheet } from "~/v0/item/ItemSheet";
import type { Feedback } from "~/v0/play/feedback/Feedback";
import { BottomNav } from "~/v0/play/BottomNav";
import { BottomSheet } from "~/v0/play/sheet/BottomSheet";
import type { ActiveSheetState } from "~/v0/play/sheet/ActiveSheetState";
import type { Sheet } from "~/v0/play/sheet/Sheet";
import { useFeedbackFlags } from "~/v0/play/feedback/useFeedbackFlags";
import { UpgradesSheet } from "~/v0/upgrade/UpgradesSheet";

export namespace PlayShell {
	export interface Props {}
}

const SheetFallback: FC = () => <div className="p-4 text-sm text-slate-300">Loading sheet…</div>;

const messageForError = (error: unknown) =>
	error instanceof Error ? error.message : typeof error === "string" ? error : "Action failed.";

export const PlayShell: FC<PlayShell.Props> = () => {
	const feedbackFlags = useFeedbackFlags();
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
	const feedback = useMemo<Feedback.Type>(
		() => ({
			pulseMergeCell(key) {
				if (key) feedbackFlags.pulse(`board:merge:${key}`);
			},
			pulseImprintCell(key) {
				if (key) feedbackFlags.pulse(`board:imprint:${key}`);
			},
			flashBoardCell(key) {
				if (key) feedbackFlags.pulse(`board:error:${key}`);
			},
			flashInventorySlot(slotIndex) {
				if (slotIndex !== undefined) feedbackFlags.pulse(`inventory:error:${slotIndex}`);
			},
			showError(error) {
				setLastError(messageForError(error));
				feedbackFlags.pulse("toast:error");
			},
		}),
		[
			feedbackFlags.pulse,
		],
	);
	const sheetContent = activeSheet
		? match(activeSheet)
				.with(
					{
						type: "inventory",
					},
					() => (
						<InventorySurface
							feedback={feedback}
							feedbackFlags={feedbackFlags.flags}
							onClose={closeSheet}
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
						type: "database",
					},
					() => <DatabaseSheet onClose={closeSheet} />,
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
		<>
			<div className="relative h-dvh w-dvw overflow-hidden px-3 pt-3 pb-[calc(var(--ak-bottom-nav-height)+0.75rem)]">
				<main className="mx-auto flex h-full ak-game-width min-h-0 flex-col gap-3 overflow-hidden">
					<div className="shrink-0 rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2">
						<p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-emerald-300">
							Arkini
						</p>
						<h1 className="text-lg font-semibold text-slate-50">Merge board</h1>
					</div>

					<div className="min-h-0 shrink-0">
						<BoardSurface
							feedback={feedback}
							feedbackFlags={feedbackFlags.flags}
							onOpenItem={openItem}
						/>
					</div>
				</main>

				{lastError && feedbackFlags.has("toast:error") ? (
					<div className="pointer-events-none absolute inset-x-3 bottom-[calc(var(--ak-bottom-nav-height)+0.85rem)] mx-auto max-w-[430px] rounded-md border border-red-300/35 bg-red-950/90 px-3 py-2 text-sm text-red-50 shadow-xl shadow-black/35">
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
		</>
	);
};
