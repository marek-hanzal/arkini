import type { FC } from "react";

export namespace BoardCellProgress {
	export interface Props {
		progress?: number;
	}
}

export const BoardCellProgress: FC<BoardCellProgress.Props> = ({ progress }) => {
	if (!progress || progress <= 0) return null;

	return (
		<div className="pointer-events-none absolute inset-0 overflow-hidden">
			<div
				className="absolute inset-x-0 bottom-0 h-full origin-bottom bg-emerald-400/16 shadow-[inset_0_1px_0_rgba(110,231,183,0.22)]"
				style={{
					transform: `scaleY(${Math.min(1, Math.max(0, progress))})`,
				}}
			/>
		</div>
	);
};
