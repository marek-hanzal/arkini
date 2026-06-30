import type { FC } from "react";
import { GameItemView } from "~/v0/item/ui/GameItemView";
import type { ViewItem } from "~/v0/item/view/ViewItemSchema";
import { DetailCard, DetailMutedPill } from "~/v0/item-detail/ui/DetailCard";

export namespace DetailHeroCard {
	export interface Props {
		item: ViewItem;
	}
}

export const DetailHeroCard: FC<DetailHeroCard.Props> = ({ item }) => (
	<DetailCard>
		<div className="flex min-w-0 gap-3">
			<div className="flex h-28 w-28 max-w-[34vw] shrink-0 items-center justify-center rounded-sm bg-ak-surface-soft p-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
				<GameItemView
					item={item}
					variant="inventory"
				/>
			</div>
			<div className="min-w-0 flex-1">
				<div className="flex min-w-0 flex-wrap items-start gap-1.5">
					<h2 className="mr-auto break-words text-xl font-black leading-7 text-ak-text">
						{item.name}
					</h2>
					<DetailMutedPill>{item.storage}</DetailMutedPill>
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
