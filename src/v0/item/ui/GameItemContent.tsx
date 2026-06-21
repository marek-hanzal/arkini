import { memo, type FC } from "react";
import { ItemLevelBadge } from "~/v0/item/ui/ItemLevelBadge";
import type { ViewItem } from "~/v0/item/view/ViewItemSchema";

export namespace GameItemContent {
	export interface Props {
		item: ViewItem;
		quantity?: number;
	}
}

export const GameItemContent: FC<GameItemContent.Props> = memo(({ item, quantity }) => (
	<div
		data-ak-item-content
		className="relative grid h-full w-full place-items-center text-ak-text"
	>
		{item.assetRender === "blueprint" && item.assetOverlaySrc ? (
			<div className="relative h-full w-full">
				<img
					src={item.assetSrc}
					alt=""
					draggable={false}
					className="absolute left-0 top-0 h-[68%] w-[68%] object-contain"
				/>
				<img
					src={item.assetOverlaySrc}
					alt=""
					draggable={false}
					className="absolute bottom-0 right-0 h-[72%] w-[72%] object-contain"
				/>
			</div>
		) : (
			<img
				src={item.assetSrc}
				alt=""
				draggable={false}
				className="h-full w-full object-contain"
			/>
		)}
		{quantity && quantity > 1 ? (
			<span className="absolute bottom-0 right-0 min-w-4 rounded-sm bg-ak-secondary px-1 text-center text-[0.62rem] font-bold text-white">
				{quantity}
			</span>
		) : item.label ? (
			<ItemLevelBadge label={item.label} />
		) : null}
	</div>
));
