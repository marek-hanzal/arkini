import { type FC, useCallback } from "react";
import { DbStatusCard } from "~/play/ui/DbStatusCard";
import { HardResetButton } from "~/play/ui/HardResetButton";
import { usePlaySave } from "~/play/hook/usePlaySave";
import { Board } from "~/board/ui/Board";
import { BottomNavigation } from "~/play/ui/BottomNavigation";
import { BottomSheet } from "~/play/ui/BottomSheet";
import { InventorySheet } from "~/inventory/ui/InventorySheet";
import { UpgradesSheet } from "~/upgrade/ui/UpgradesSheet";
import { ItemDetailSheet } from "~/item/ui/ItemDetailSheet";
import { SheetHeader } from "~/shared/ui/SheetHeader";
import { usePlaySheets } from "~/play/hook/usePlaySheets";

export namespace PlayShell {
	export interface Props {}
}

export const PlayShell: FC<PlayShell.Props> = () => {
	const saveQuery = usePlaySave();
	const sheets = usePlaySheets();
	const openBoardTileDetail = useCallback(
		(boardItemId: string) => {
			sheets.openItem(boardItemId);
		},
		[
			sheets.openItem,
		],
	);

	if (saveQuery.isPending) {
		return (
			<div className="grid h-dvh w-dvw place-items-center text-sm text-slate-400">
				Booting SQLite…
			</div>
		);
	}

	if (saveQuery.isError || !saveQuery.data) {
		return (
			<div className="grid h-dvh w-dvw place-items-center p-4">
				<div className="w-full max-w-xl rounded-md border border-red-400/30 bg-red-950/30 p-4 text-sm text-red-100">
					<p>{(saveQuery.error as Error)?.message ?? "Game failed to load."}</p>
					<div className="mt-4">
						<HardResetButton />
					</div>
				</div>
			</div>
		);
	}

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
						<Board onOpenItem={openBoardTileDetail} />
					</div>
				</main>

				<BottomNavigation
					activeSheet={sheets.activeSheet}
					onOpen={sheets.openSheet}
				/>
			</div>

			<BottomSheet
				open={sheets.activeSheet !== undefined}
				onClose={sheets.closeSheet}
			>
				<div className="min-h-0">
					<section
						className="min-h-0"
						hidden={sheets.renderedSheet !== "inventory"}
					>
						<InventorySheet onClose={sheets.closeSheet} />
					</section>

					<section
						className="min-h-0"
						hidden={sheets.renderedSheet !== "upgrades"}
					>
						<UpgradesSheet onClose={sheets.closeSheet} />
					</section>

					<section
						className="max-h-[var(--ak-sheet-max-height)] overflow-y-auto overscroll-contain"
						hidden={sheets.renderedSheet !== "database"}
					>
						<SheetHeader
							eyebrow="System"
							description="Local database"
							onClose={sheets.closeSheet}
						/>
						<div className="p-4 pt-1">
							<DbStatusCard />
						</div>
					</section>

					<section
						className="max-h-[var(--ak-sheet-max-height)] overflow-y-auto overscroll-contain"
						hidden={sheets.renderedSheet !== "item"}
					>
						<ItemDetailSheet
							boardItemId={sheets.selectedBoardItemId}
							onClose={sheets.closeSheet}
						/>
					</section>
				</div>
			</BottomSheet>
		</>
	);
};
