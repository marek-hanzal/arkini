import { match } from "ts-pattern";
import { type FC, Suspense, useCallback, useMemo, useState } from "react";
import { V0BoardSurface } from "~/v0/board/V0BoardSurface";
import { V0DatabaseSheet } from "~/v0/database/V0DatabaseSheet";
import { V0InventorySurface } from "~/v0/inventory/V0InventorySurface";
import { V0ItemSheet } from "~/v0/item/V0ItemSheet";
import type { V0Feedback } from "~/v0/play/V0Feedback";
import { V0BottomNav } from "~/v0/play/V0BottomNav";
import { V0BottomSheet } from "~/v0/play/V0BottomSheet";
import type { V0ActiveSheetState, V0Sheet } from "~/v0/play/V0Sheet";
import { useTransientFlags } from "~/v0/shared/useTransientFlags";
import { V0UpgradesSheet } from "~/v0/upgrade/V0UpgradesSheet";

export namespace V0PlayShell {
	export interface Props {}
}

const SheetFallback: FC = () => <div className="p-4 text-sm text-slate-300">Loading sheet…</div>;

const messageForError = (error: unknown) =>
	error instanceof Error ? error.message : typeof error === "string" ? error : "Action failed.";

export const V0PlayShell: FC<V0PlayShell.Props> = () => {
	const feedbackFlags = useTransientFlags();
	const [activeSheet, setActiveSheet] = useState<V0ActiveSheetState | undefined>();
	const [lastError, setLastError] = useState<string | undefined>();
	const closeSheet = useCallback(() => setActiveSheet(undefined), []);
	const openSheet = useCallback(
		(sheet: V0Sheet) =>
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
	const feedback = useMemo<V0Feedback>(
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
			feedbackFlags,
		],
	);
	const sheetContent = activeSheet
		? match(activeSheet)
				.with(
					{
						type: "inventory",
					},
					() => (
						<V0InventorySurface
							feedback={feedback}
							hasFeedback={feedbackFlags.has}
							onClose={closeSheet}
						/>
					),
				)
				.with(
					{
						type: "upgrades",
					},
					() => <V0UpgradesSheet onClose={closeSheet} />,
				)
				.with(
					{
						type: "database",
					},
					() => <V0DatabaseSheet onClose={closeSheet} />,
				)
				.with(
					{
						type: "item",
					},
					(sheet) => (
						<V0ItemSheet
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
							Arkini / v0
						</p>
						<h1 className="text-lg font-semibold text-slate-50">Merge board</h1>
					</div>

					<div className="min-h-0 shrink-0">
						<V0BoardSurface
							feedback={feedback}
							hasFeedback={feedbackFlags.has}
							onOpenItem={openItem}
						/>
					</div>
				</main>

				{lastError && feedbackFlags.has("toast:error") ? (
					<div className="pointer-events-none absolute inset-x-3 bottom-[calc(var(--ak-bottom-nav-height)+0.85rem)] mx-auto max-w-[430px] rounded-md border border-red-300/35 bg-red-950/90 px-3 py-2 text-sm text-red-50 shadow-xl shadow-black/35">
						{lastError}
					</div>
				) : null}

				<V0BottomNav
					activeSheet={activeSheet?.type}
					onOpen={openSheet}
				/>
			</div>

			<V0BottomSheet
				open={Boolean(activeSheet)}
				onClose={closeSheet}
			>
				<Suspense fallback={<SheetFallback />}>{sheetContent}</Suspense>
			</V0BottomSheet>
		</>
	);
};
