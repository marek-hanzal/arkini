import type { FC } from "react";
import { Board } from "~/board/ui/Board";
import { usePlayShellController } from "~/play/hook/usePlayShellController";
import { BottomNavigation } from "~/play/ui/BottomNavigation";
import { BottomSheet } from "~/play/ui/BottomSheet";
import { PlaySheetContent } from "~/play/ui/PlaySheetContent";

export namespace PlayShell {
	export interface Props {}
}

export const PlayShell: FC<PlayShell.Props> = () => {
	const controller = usePlayShellController();

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
						<Board
							drag={controller.boardDrag}
							feedback={controller.boardFeedback}
							actions={controller.boardActions}
							visualMotions={controller.visualMotions}
						/>
					</div>
				</main>

				<BottomNavigation
					activeSheet={controller.activeSheet}
					inventoryDropTargetActive={controller.drag.activeDrag?.source.kind === "board"}
					activeDropTargetNodeId={controller.drag.activeDropTargetNodeId}
					onOpen={controller.openSheet}
				/>
			</div>

			<BottomSheet
				open={controller.activeSheet !== undefined}
				onClose={controller.closeSheet}
			>
				<PlaySheetContent controller={controller} />
			</BottomSheet>
		</>
	);
};
