import type { FC } from "react";
import type { ItemTargetLimitView } from "~/board/view/ItemTargetLimitViewSchema";
import type { ItemCatalogView } from "~/item/view/ItemCatalogViewSchema";
import { cn } from "~/ui/cn";
import { readDetailItemName } from "~/item-detail/ui/readDetailItemName";

export namespace DetailTargetLimits {
	export interface Props {
		id: string;
		items: ItemCatalogView;
		limits: readonly ItemTargetLimitView[];
	}
}

const readLimitReached = (limit: ItemTargetLimitView) =>
	limit.remainingQuantity < limit.requiredQuantity;

export const DetailTargetLimits: FC<DetailTargetLimits.Props> = ({ id, items, limits }) => {
	if (limits.length === 0) return null;

	return (
		<div
			data-ui="target limits"
			className="rounded-sm bg-violet-300/10 px-2.5 py-2 text-xs"
		>
			<p className="font-black text-ak-text">Target limits</p>
			<div className="mt-1.5 grid gap-1.5">
				{limits.map((limit) => {
					const limitReached = readLimitReached(limit);
					const itemName = readDetailItemName({
						itemId: limit.itemId,
						items,
					});

					return (
						<div
							key={`${id}:target-limit:${limit.itemId}`}
							className={cn(
								"flex min-w-0 items-center justify-between gap-3 rounded-sm border px-2.5 py-2",
								limitReached
									? "border-rose-300/35 bg-rose-400/12"
									: "border-violet-100/10 bg-ak-surface/55",
							)}
						>
							<div className="min-w-0 flex-1">
								<p
									data-ui="target limit name"
									className="break-words font-black leading-5 text-ak-text"
								>
									{itemName}
								</p>
								{limitReached ? (
									<p className="mt-0.5 text-[11px] font-black uppercase tracking-[0.14em] text-rose-200">
										Limit reached
									</p>
								) : null}
							</div>
							<p
								data-ui="target limit count"
								className={cn(
									"shrink-0 text-right text-xl font-black leading-none tabular-nums",
									limitReached ? "text-rose-100" : "text-ak-text",
								)}
							>
								{limit.ownedQuantity}
								<span className="text-sm text-ak-text-muted">
									/{limit.maxCount}
								</span>
							</p>
						</div>
					);
				})}
			</div>
		</div>
	);
};
