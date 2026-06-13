import { useEffect, useRef } from "react";
import type { BoardViewItem } from "~/play/logic/playTypes";
import { playProducerCooldown } from "~/play/util/animation";
import { queryElement } from "~/shared/util/queryElement";
import { isProducerReady } from "~/producer/logic/isProducerReady";

export function useProducerReadySignals(items: readonly BoardViewItem[], nowMs: number) {
	const previousReadyRef = useRef(new Map<string, boolean>());

	useEffect(() => {
		const previousReady = previousReadyRef.current;
		const nextReady = new Map<string, boolean>();

		for (const item of items) {
			if (!item.producer) continue;

			const ready = isProducerReady(item.producer, nowMs);
			const previous = previousReady.get(item.id);
			nextReady.set(item.id, ready);

			if (previous === true && !ready) {
				const element = queryElement(`[data-board-cell="${item.x}:${item.y}"]`);
				if (element) playProducerCooldown(element);
			}
		}

		previousReadyRef.current = nextReady;
	}, [
		items,
		nowMs,
	]);
}
