import type { BoardViewItem, ProducerView, ViewItem } from "~/play/logic/playTypes";
import type { RectLike } from "~/play/types";
import { useProducerNow } from "~/producer/hook/useProducerNow";
import { cn } from "~/shared/cn";
import { formatMs } from "~/shared/util/format";

export namespace GameItemView {
	export type Variant = "board" | "inventory" | "drag" | "flyer";

	export interface Props {
		item: ViewItem;
		variant: Variant;
		quantity?: number;
		producer?: BoardViewItem["producer"];
		overlaySize?: Pick<RectLike, "width" | "height"> | null;
	}
}

export function GameItemView({
	item,
	variant,
	quantity,
	producer,
	overlaySize,
}: GameItemView.Props) {
	return (
		<div
			data-ak-item-view
			data-ak-item-variant={variant}
			className={cn(
				"relative h-full w-full select-none",
				variant === "board" && "p-[13%]",
				variant === "inventory" && "p-[12%]",
				variant === "drag" && "p-[10%] drop-shadow-2xl",
				variant === "flyer" && "p-[10%] drop-shadow-xl",
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
			/>
		</div>
	);
}

namespace GameItemContent {
	export interface Props {
		item: ViewItem;
		quantity?: number;
		producer?: BoardViewItem["producer"];
	}
}

function GameItemContent({ item, quantity, producer }: GameItemContent.Props) {
	const nowMs = useProducerNow(producer);
	const producerUi = producer ? getProducerUiState(producer, nowMs) : null;

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
}

namespace ItemLevelBadge {
	export interface Props {
		label: string;
	}
}

function ItemLevelBadge({ label }: ItemLevelBadge.Props) {
	return (
		<span className="absolute bottom-0.5 right-0.5 min-w-4 rounded-sm bg-slate-950/85 px-1 text-center text-[0.62rem] font-black text-amber-200 shadow-sm">
			{label}
		</span>
	);
}

interface ProducerUiState {
	label: string;
	title: string;
	progress: number | null;
	waiting: boolean;
}

namespace ProducerBadge {
	export interface Props {
		ui: ProducerUiState;
	}
}

function ProducerBadge({ ui }: ProducerBadge.Props) {
	return (
		<span
			title={ui.title}
			className={cn(
				"absolute left-0.5 top-0.5 min-w-5 overflow-hidden rounded-sm px-1 pb-0.5 pt-0.5 text-center text-[0.56rem] font-black shadow-sm",
				ui.waiting
					? "bg-slate-950/82 text-emerald-200"
					: "bg-emerald-300/18 text-emerald-100 ring-1 ring-emerald-200/45",
			)}
		>
			<span>{ui.label}</span>
			{ui.progress !== null ? (
				<span className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden rounded-b-sm bg-slate-700/80">
					<span
						className="block h-full bg-emerald-300/80"
						style={{
							width: `${ui.progress * 100}%`,
						}}
					/>
				</span>
			) : null}
		</span>
	);
}

function getProducerUiState(producer: ProducerView, nowMs: number): ProducerUiState {
	const cooldownUntil = producer.cooldownUntil ? Date.parse(producer.cooldownUntil) : 0;
	const cooldownLeft = Math.max(0, cooldownUntil - nowMs);
	const max = producer.cooldownMs ?? cooldownLeft;

	if (cooldownLeft > 0) {
		return {
			label: formatMs(cooldownLeft),
			title: `Cooling down: ${formatMs(cooldownLeft)}`,
			progress: max > 0 ? 1 - cooldownLeft / max : null,
			waiting: true,
		};
	}

	const charges = producer.remainingCharges;
	return {
		label: charges !== null && charges !== undefined ? String(charges) : "▶",
		title: charges !== null && charges !== undefined ? `${charges} charges left` : "Ready",
		progress: null,
		waiting: false,
	};
}
