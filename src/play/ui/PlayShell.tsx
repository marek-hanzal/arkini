import { useRef, type FC } from "react";
import { Board } from "~/board/ui/Board";
import { BottomNavigationHost } from "~/play/ui/BottomNavigationHost";
import { PlayRootElementProvider } from "~/play/ui/PlayRootElementProvider";
import { PlaySessionProvider } from "~/play/ui/PlaySessionProvider";
import { PlaySheetHost } from "~/play/ui/PlaySheetHost";

export namespace PlayShell {
	export interface Props {}
}

export const PlayShell: FC<PlayShell.Props> = () => {
	const rootRef = useRef<HTMLDivElement | null>(null);

	return (
		<PlaySessionProvider>
			<PlayRootElementProvider rootRef={rootRef}>
				<div
					ref={rootRef}
					data-ak-play-root=""
					className="relative h-dvh w-dvw overflow-hidden px-3 pt-3 pb-[calc(var(--ak-bottom-nav-height)+0.75rem)]"
				>
					<main className="mx-auto flex h-full ak-game-width min-h-0 flex-col gap-3 overflow-hidden">
						<div className="shrink-0 rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2">
							<p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-emerald-300">
								Arkini
							</p>
							<h1 className="text-lg font-semibold text-slate-50">Merge board</h1>
						</div>

						<div className="min-h-0 shrink-0">
							<Board />
						</div>
					</main>

					<BottomNavigationHost />
				</div>

				<PlaySheetHost />
			</PlayRootElementProvider>
		</PlaySessionProvider>
	);
};
