import { useMemo } from "react";
import type { BoardViewItem } from "~/v0/board/view/BoardViewItemSchema";
import { useLiveNowMs } from "~/v0/time/useLiveNowMs";

export function useProducerClock(items: readonly BoardViewItem[]) {
	const activeUntilMs = useMemo(
		() =>
			items.flatMap((item) => [
				item.activation?.cooldownUntilMs,
				...(item.activation?.lines?.map((line) => line.readyAtMs) ?? []),
				item.craft?.readyAtMs,
			]),
		[
			items,
		],
	);

	return useLiveNowMs(activeUntilMs);
}
