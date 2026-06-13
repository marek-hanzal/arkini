import type { FC } from "react";
import { GameItemContent } from "~/item/ui/GameItemContent";
import type { BoardViewItem, ViewItem } from "~/play/logic/playTypes";
import type { RectLike } from "~/play/types";
import { cn } from "~/shared/cn";

export namespace GameItemView {
	export type Variant = "board" | "inventory" | "drag" | "flyer";

	export type SizeVariant = Exclude<Variant, "drag">;

	export interface Props {
		item: ViewItem;
		variant: Variant;
		sizeVariant?: SizeVariant;
		quantity?: number;
		producer?: BoardViewItem["producer"];
		overlaySize?: Pick<RectLike, "width" | "height">;
		producerNowMs?: number;
	}
}

export const GameItemView: FC<GameItemView.Props> = ({
	item,
	variant,
	sizeVariant,
	quantity,
	producer,
	overlaySize,
	producerNowMs,
}) => {
	const resolvedSizeVariant = sizeVariant ?? (variant === "drag" ? "board" : variant);

	return (
		<div
			data-ak-item-view
			data-ak-item-variant={variant}
			data-ak-item-size-variant={resolvedSizeVariant}
			className={cn(
				"relative h-full w-full select-none",
				resolvedSizeVariant === "board" && "p-[13%]",
				resolvedSizeVariant === "inventory" && "p-[12%]",
				resolvedSizeVariant === "flyer" && "p-[10%]",
			)}
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
				producer={producer}
				producerNowMs={producerNowMs}
			/>
		</div>
	);
};
