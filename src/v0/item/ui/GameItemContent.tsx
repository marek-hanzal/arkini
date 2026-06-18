import { memo, type FC } from "react";
import { ItemLevelBadge } from "~/v0/item/ui/ItemLevelBadge";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import type { ViewItem } from "~/v0/item/view/ViewItemSchema";
import { cn } from "~/v0/ui/cn";

export namespace GameItemContent {
	export interface Props {
		item: ViewItem;
		quantity?: number;
		activation?: BoardViewItem["activation"];
		activationNowMs?: number;
	}
}

export const GameItemContent: FC<GameItemContent.Props> = memo(
	({ item, quantity, activation, activationNowMs }) => {
		const activationWaiting = activation
			? (activation.cooldownUntilMs ?? 0) > (activationNowMs ?? Date.now())
			: false;

		return (
			<div
				data-ak-item-content
				className={cn(
					"relative grid h-full w-full place-items-center text-ak-text",
					activationWaiting && "opacity-[0.82]",
				)}
			>
				{item.assetRender === "blueprint" && item.assetOverlaySrc ? (
					<div className="relative h-full w-full">
						<img
							src={item.assetSrc}
							alt=""
							draggable={false}
							className="absolute left-0 top-0 h-[68%] w-[68%] object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
						/>
						<img
							src={item.assetOverlaySrc}
							alt=""
							draggable={false}
							className="absolute bottom-0 right-0 h-[72%] w-[72%] object-contain drop-shadow-[0_2px_3px_rgba(0,0,0,0.45)]"
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
					<span className="absolute bottom-0 right-[8px] min-w-4 rounded-sm bg-fuchsia-700/90 px-1 text-center text-[0.62rem] font-bold text-white shadow-sm">
						{quantity}
					</span>
				) : item.label ? (
					<ItemLevelBadge label={item.label} />
				) : null}
			</div>
		);
	},
);
