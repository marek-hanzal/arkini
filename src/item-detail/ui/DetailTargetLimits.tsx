import type { FC } from "react";
import type { ItemTargetLimitView } from "~/board/view/ItemTargetLimitViewSchema";
import type { ItemCatalogView } from "~/item/view/ItemCatalogViewSchema";
import { cn } from "~/ui/cn";

export namespace DetailTargetLimits {
	export interface Props {
		id: string;
		items: ItemCatalogView;
		limits: readonly ItemTargetLimitView[];
	}
}

const readLimitReached = (limit: ItemTargetLimitView) =>
	limit.remainingQuantity < limit.requiredQuantity;

const readLimitLabel = (limit: ItemTargetLimitView) => {
	if (limit.maxCount === 1) return "Unique";
	return `Limit ${limit.ownedQuantity}/${limit.maxCount}`;
};

export const DetailTargetLimits: FC<DetailTargetLimits.Props> = ({ id, limits }) => {
	if (limits.length === 0) return null;

	return (
		<div
			data-ui="target limits"
			className="flex min-w-0 flex-wrap gap-1.5"
		>
			{limits.map((limit) => {
				const limitReached = readLimitReached(limit);

				return (
					<span
						key={`${id}:target-limit:${limit.itemId}`}
						data-ui="target limit badge"
						className={cn(
							"inline-flex min-w-0 items-center rounded-full border px-2.5 py-1 text-[0.68rem] font-black uppercase leading-none tracking-[0.14em] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]",
							limitReached
								? "border-rose-300/40 bg-rose-400/15 text-rose-100"
								: "border-violet-200/25 bg-violet-300/12 text-violet-50",
						)}
					>
						{readLimitLabel(limit)}
					</span>
				);
			})}
		</div>
	);
};
