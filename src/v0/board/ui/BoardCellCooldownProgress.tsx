import { memo, type FC } from "react";

export namespace BoardCellCooldownProgress {
	export interface Props {
		progress?: number;
	}
}

export const BoardCellCooldownProgress: FC<BoardCellCooldownProgress.Props> = memo(
	({ progress }) => {
		if (progress === undefined || progress <= 0) return null;

		return (
			<div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 overflow-hidden bg-pink-50/85">
				<div
					className="h-full origin-left bg-fuchsia-400/85 transition-transform duration-200 ease-linear"
					style={{
						transform: `scaleX(${Math.min(1, Math.max(0, progress))})`,
					}}
				/>
			</div>
		);
	},
);
