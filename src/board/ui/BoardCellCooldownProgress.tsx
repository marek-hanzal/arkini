import type { FC } from "react";

export namespace BoardCellCooldownProgress {
	export interface Props {
		progress?: number;
	}
}

export const BoardCellCooldownProgress: FC<BoardCellCooldownProgress.Props> = ({
	progress,
}) => {
	if (progress === undefined || progress <= 0) return null;

	return (
		<div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-1 overflow-hidden bg-slate-950/75">
			<div
				className="h-full origin-left bg-cyan-300/85 transition-transform duration-200 ease-linear"
				style={{
					transform: `scaleX(${Math.min(1, Math.max(0, progress))})`,
				}}
			/>
		</div>
	);
};
