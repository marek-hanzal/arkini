import { memo, type FC } from "react";
import { GameItemContent } from "~/v0/item/ui/GameItemContent";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import type { ViewItem } from "~/v0/item/view/ViewItemSchema";

export namespace GameItemView {
	export type Variant = "board" | "inventory" | "drag";

	export type SizeVariant = "board" | "inventory";

	export interface OverlaySize {
		width: number;
		height: number;
	}

	export interface Props {
		item: ViewItem;
		variant: Variant;
		sizeVariant?: SizeVariant;
		quantity?: number;
		activation?: BoardViewItem["activation"];
		overlaySize?: GameItemView.OverlaySize;
		activationNowMs?: number;
	}
}

export const GameItemView: FC<GameItemView.Props> = memo(
	({ item, variant, sizeVariant, quantity, activation, overlaySize, activationNowMs }) => {
		const resolvedSizeVariant =
			sizeVariant ?? (variant === "inventory" ? "inventory" : "board");

		return (
			<div
				data-ak-item-view
				data-ak-item-variant={variant}
				data-ak-item-size-variant={resolvedSizeVariant}
				className="relative h-full w-full select-none p-[13%]"
				style={
					variant === "drag" && overlaySize
						? {
								width: overlaySize.width,
								height: overlaySize.height,
							}
						: undefined
				}
			>
				<GameItemContent
					item={item}
					quantity={quantity}
					activation={activation}
					activationNowMs={activationNowMs}
				/>
			</div>
		);
	},
);
