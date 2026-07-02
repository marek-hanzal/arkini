import type { FC } from "react";
import { GameItemView } from "~/item/ui/GameItemView";
import type { ViewItem } from "~/item/view/ViewItemSchema";
import { DetailCard, DetailMutedPill } from "~/item-detail/ui/DetailCard";

export namespace DetailHeroCard {
	export interface Props {
		assetProgress?: number;
		item: ViewItem;
	}
}

export const DetailHeroCard: FC<DetailHeroCard.Props> = ({ assetProgress, item }) => (
	<DetailCard>
		<div className="flex min-w-0 gap-4">
			<div className="flex h-28 w-28 max-w-[34vw] shrink-0 items-center justify-center rounded-sm bg-ak-surface-soft p-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
				<GameItemView
					assetProgress={assetProgress}
					item={item}
					variant="inventory"
				/>
			</div>
			<div className="min-w-0 flex-1">
				<div className="flex min-w-0 flex-wrap items-start gap-1.5">
					<h2 className="mr-auto break-words text-[1.75rem] font-black leading-8 text-ak-text">
						{item.name}
					</h2>
					{item.maxStackSize > 1 ? (
						<DetailMutedPill>Stack {item.maxStackSize}</DetailMutedPill>
					) : null}
				</div>
				<p className="mt-2 break-words text-sm leading-6 text-ak-text-muted">
					{item.description}
				</p>
				{item.tags.length ? (
					<div className="mt-3 flex flex-wrap gap-1">
						{item.tags.map((tag) => (
							<DetailMutedPill key={tag}>{tag}</DetailMutedPill>
						))}
					</div>
				) : null}
			</div>
		</div>
	</DetailCard>
);
