import { useMemo } from "react";
import type { BoardViewItem } from "~/board/view/BoardViewItemSchema";
import { useLiveNowMs } from "~/time/useLiveNowMs";

export function useBoardItemClock(items: readonly BoardViewItem[]) {
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
