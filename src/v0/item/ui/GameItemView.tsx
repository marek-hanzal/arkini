import { memo, type FC } from "react";
import { GameItemContent } from "~/v0/item/ui/GameItemContent";
import type { ViewItem } from "~/v0/item/view/ViewItemSchema";

export namespace GameItemView {
	type Variant = "board" | "inventory" | "drag";
	type SizeVariant = "board" | "inventory";

	export interface OverlaySize {
		width: number;
		height: number;
	}

	export interface Props {
		item: ViewItem;
		variant: Variant;
		sizeVariant?: SizeVariant;
		quantity?: number;
		overlaySize?: GameItemView.OverlaySize;
	}
}

export const GameItemView: FC<GameItemView.Props> = memo(
	({ item, variant, sizeVariant, quantity, overlaySize }) => {
		const resolvedSizeVariant =
			sizeVariant ?? (variant === "inventory" ? "inventory" : "board");

		return (
			<div
				data-ui="item view"
				data-ak-item-view
				data-ak-item-variant={variant}
				data-ak-item-size-variant={resolvedSizeVariant}
				className="relative h-full w-full select-none p-[5%]"
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
				/>
			</div>
		);
	},
);
