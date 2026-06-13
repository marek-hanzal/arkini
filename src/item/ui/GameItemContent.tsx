import type { FC } from "react";
import { getProducerUiState } from "~/item/logic/getProducerUiState";
import { ItemLevelBadge } from "~/item/ui/ItemLevelBadge";
import { ProducerBadge } from "~/item/ui/ProducerBadge";
import type { BoardViewItem, ViewItem } from "~/play/logic/playTypes";
import { cn } from "~/shared/cn";

export namespace GameItemContent {
	export interface Props {
		item: ViewItem;
		quantity?: number;
		producer?: BoardViewItem["producer"];
		producerNowMs?: number;
	}
}

export const GameItemContent: FC<GameItemContent.Props> = ({
	item,
	quantity,
	producer,
	producerNowMs,
}) => {
	const nowMs = producerNowMs ?? Date.now();
	const producerUi = producer ? getProducerUiState(producer, nowMs) : undefined;

	return (
		<div
			data-ak-item-content
			className={cn(
				"relative grid h-full w-full place-items-center text-slate-50",
				producerUi?.waiting && "opacity-82",
			)}
		>
			<img
				src={item.assetSrc}
				alt=""
				draggable={false}
				className="h-full w-full object-contain"
			/>
			{quantity && quantity > 1 ? (
				<span
					className={cn(
						"absolute bottom-0.5 rounded-sm bg-slate-950/82 px-1 text-[0.62rem] font-bold text-slate-100 shadow-sm",
						item.label ? "left-0.5" : "right-0.5",
					)}
				>
					{quantity}
				</span>
			) : null}
			{item.label ? <ItemLevelBadge label={item.label} /> : null}
			{producerUi ? <ProducerBadge ui={producerUi} /> : null}
		</div>
	);
};
