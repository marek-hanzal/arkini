import { useEffect, useRef } from "react";
import type { BoardViewItem } from "~/play/logic/playTypes";
import { isProducerReady } from "~/producer/logic/isProducerReady";

export function useProducerReadySignals(items: readonly BoardViewItem[], nowMs: number) {
	const previous = useRef<Record<string, boolean>>({});

	useEffect(() => {
		const next: Record<string, boolean> = {};

		for (const item of items) {
			if (!item.activation) continue;

			const ready = isProducerReady(item.activation, nowMs);
			next[item.id] = ready;

			const wasReady = previous.current[item.id];
			const coolingDown = (item.activation.cooldownUntilMs ?? 0) > nowMs;
			if (ready && wasReady === false && coolingDown) {
				window.navigator.vibrate?.(12);
			}
		}

		previous.current = next;
	}, [
		items,
		nowMs,
	]);
}
