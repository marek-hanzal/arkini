import type { BoardViewItem, ProducerView, ViewItem } from "~/play/logic/playTypes";
import { cn } from "~/shared/cn";
import { formatMs } from "~/shared/util/format";
import { useProducerNow } from "~/producer/hook/useProducerNow";
import type { RectLike } from "~/play/types";

export namespace Tile {
  export interface Props {
    item: ViewItem;
    quantity?: number;
    producer?: BoardViewItem["producer"];
    dragOverlay?: boolean;
    overlaySize?: Pick<RectLike, "width" | "height"> | null;
  }
}

export function Tile({
  item,
  quantity,
  producer,
  dragOverlay,
  overlaySize,
}: Tile.Props) {
  return (
    <div
      data-ak-tile
      className={cn(
        "relative h-full w-full p-[10%]",
        dragOverlay && "shadow-2xl shadow-black/50",
      )}
      style={dragOverlay && overlaySize ? { width: overlaySize.width, height: overlaySize.height } : undefined}
    >
      <TileContent item={item} quantity={quantity} producer={producer} />
    </div>
  );
}

namespace TileContent {
  export interface Props {
    item: ViewItem;
    quantity?: number;
    producer?: BoardViewItem["producer"];
  }
}

export function TileContent({ item, quantity, producer }: TileContent.Props) {
  const nowMs = useProducerNow(producer);
  const producerUi = producer ? getProducerUiState(producer, nowMs) : null;

  return (
    <div
      data-ak-tile-content
      className={cn(
        "relative grid h-full w-full place-items-center text-slate-50",
        producerUi?.waiting && "opacity-80",
      )}
    >
      <img src={item.assetSrc} alt="" draggable={false} className="h-full w-full object-contain" />
      {quantity && quantity > 1 ? (
        <span className={cn(
          "absolute bottom-0.5 rounded-sm bg-slate-950/80 px-1 text-[0.62rem] font-bold text-slate-100",
          item.label ? "left-0.5" : "right-0.5",
        )}>{quantity}</span>
      ) : null}
      {item.label ? <span className="absolute bottom-0.5 right-0.5 min-w-4 rounded-sm bg-slate-950/85 px-1 text-center text-[0.62rem] font-black text-amber-200">{item.label}</span> : null}
      {producerUi ? <ProducerBadge ui={producerUi} /> : null}
    </div>
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
    <span title={ui.title} className="absolute left-0.5 top-0.5 min-w-5 rounded-sm bg-slate-950/85 px-1 pb-0.5 pt-0.5 text-center text-[0.56rem] font-bold text-emerald-200">
      <span>{ui.label}</span>
      {ui.progress !== null ? (
        <span className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden rounded-b-sm bg-slate-700/80">
          <span className="block h-full bg-emerald-300/80" style={{ width: `${ui.progress * 100}%` }} />
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
