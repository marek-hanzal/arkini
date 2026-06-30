import type { FC } from "react";

export namespace ItemLevelBadge {
	export interface Props {
		label: string;
	}
}

export const ItemLevelBadge: FC<ItemLevelBadge.Props> = ({ label }) => {
	return (
		<span className="absolute bottom-0 right-0 min-w-4 rounded-sm bg-ak-secondary px-1 text-center text-[0.62rem] font-black text-white">
			{label}
		</span>
	);
};
