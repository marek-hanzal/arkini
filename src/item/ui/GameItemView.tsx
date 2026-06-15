import { memo, type FC } from "react";
import { GameItemContent } from "~/item/ui/GameItemContent";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import type { ViewItem } from "~/item/view/ViewItemSchema";
import type { RectLike } from "~/play/types";

export namespace GameItemView {
	export type Variant = "board" | "inventory" | "drag";

	export type SizeVariant = "board" | "inventory";

	export interface Props {
		item: ViewItem;
		variant: Variant;
		sizeVariant?: SizeVariant;
		quantity?: number;
		activation?: BoardViewItem["activation"];
		overlaySize?: Pick<RectLike, "width" | "height">;
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
