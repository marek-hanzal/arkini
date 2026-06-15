import type { FC } from "react";

export namespace ItemLevelBadge {
	export interface Props {
		label: string;
	}
}

export const ItemLevelBadge: FC<ItemLevelBadge.Props> = ({ label }) => {
	return (
		<span className="absolute bottom-0.5 right-0.5 min-w-4 rounded-sm bg-slate-950/85 px-1 text-center text-[0.62rem] font-black text-amber-200 shadow-sm">
			{label}
		</span>
	);
};
