import type { BoardViewItem, ViewItem } from "~/domains/database";
import { cn } from "~/lib/cn";
import { formatMs } from "../utils/format";
import type { ProducerView, RectLike } from "../types";

export function Tile({
  item,
  quantity,
  producer,
  nowMs,
  dragOverlay,
  overlaySize,
}: Readonly<{
  item: ViewItem;
  quantity?: number;
  producer?: BoardViewItem["producer"];
  nowMs?: number;
  dragOverlay?: boolean;
  overlaySize?: Pick<RectLike, "width" | "height"> | null;
}>) {
  return (
    <div
      data-ak-tile
      className={cn(
        "relative h-full w-full p-[10%]",
        dragOverlay && "shadow-2xl shadow-black/50",
      )}
      style={dragOverlay && overlaySize ? { width: overlaySize.width, height: overlaySize.height } : undefined}
    >
      <TileContent item={item} quantity={quantity} producer={producer} nowMs={nowMs} />
    </div>
  );
}

export function TileContent({
  item,
  quantity,
  producer,
  nowMs,
}: Readonly<{
  item: ViewItem;
  quantity?: number;
  producer?: BoardViewItem["producer"];
  nowMs?: number;
}>) {
  const producerUi = producer ? getProducerUiState(producer, nowMs ?? Date.now()) : null;

  return (
    <div
      data-ak-tile-content
      className={cn(
        "relative grid h-full w-full place-items-center text-slate-50",
        producerUi?.waiting && "opacity-80",
        producerUi?.paused && "opacity-65",
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
      {producer && producerUi ? <ProducerBadge producer={producer} ui={producerUi} /> : null}
    </div>
  );
}

interface ProducerUiState {
  label: string;
  title: string;
  progress: number | null;
  waiting: boolean;
  paused: boolean;
}

function ProducerBadge({ ui }: Readonly<{ producer: ProducerView; ui: ProducerUiState }>) {
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
  const nextDropAt = producer.nextDropAt ? Date.parse(producer.nextDropAt) : 0;
  const rechargeUntil = producer.rechargeUntil ? Date.parse(producer.rechargeUntil) : 0;

  if (producer.paused) {
    return { label: "||", title: "Paused", progress: null, waiting: true, paused: true };
  }

  if (producer.trigger === "click") {
    const cooldownLeft = Math.max(0, cooldownUntil - nowMs);
    const max = producer.cooldownMs ?? cooldownLeft;
    if (cooldownLeft > 0) {
      return {
        label: formatMs(cooldownLeft),
        title: `Cooling down: ${formatMs(cooldownLeft)}`,
        progress: max > 0 ? 1 - cooldownLeft / max : null,
        waiting: true,
        paused: false,
      };
    }

    const charges = producer.remainingCharges;
    return {
      label: charges !== null && charges !== undefined ? String(charges) : "▶",
      title: charges !== null && charges !== undefined ? `${charges} charges left` : "Ready",
      progress: null,
      waiting: false,
      paused: false,
    };
  }

  const rechargeLeft = Math.max(0, rechargeUntil - nowMs);
  if (rechargeLeft > 0) {
    const max = producer.mode.type === "auto" ? producer.mode.rechargeMs : rechargeLeft;
    return {
      label: formatMs(rechargeLeft),
      title: `Recharging: ${formatMs(rechargeLeft)}`,
      progress: max > 0 ? 1 - rechargeLeft / max : null,
      waiting: true,
      paused: false,
    };
  }

  const tickLeft = Math.max(0, nextDropAt - nowMs);
  const available = producer.autoAvailable ?? 0;
  if (tickLeft > 0) {
    const max = producer.mode.type === "auto" ? producer.mode.tickMs : tickLeft;
    return {
      label: String(available),
      title: `Next drop in ${formatMs(tickLeft)} · ${available} queued charges`,
      progress: max > 0 ? 1 - tickLeft / max : null,
      waiting: true,
      paused: false,
    };
  }

  return {
    label: String(available || "▶"),
    title: `${available} queued charges ready`,
    progress: null,
    waiting: false,
    paused: false,
  };
}
