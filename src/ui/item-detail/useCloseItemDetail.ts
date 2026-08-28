import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { useAtom } from "@effect/atom-react";
import { useCallback } from "react";

import type { CloseItemDetailProps } from "~/ui/item-detail/ItemDetailControl";
import { useItemDetailControl } from "~/ui/item-detail/useItemDetailControl";
import { readSettledAsyncResultErrorFx } from "~/ui/reactivity/readSettledAsyncResultErrorFx";

/** Runs the controller-owned close command and surfaces lifecycle causes to the boundary. */
export const useCloseItemDetail = () => {
	const itemDetail = useItemDetailControl();
	const [result, close] = useAtom(itemDetail.closeAtom);
	RendererRuntime.runSync(readSettledAsyncResultErrorFx(result));
	return useCallback(
		(props?: CloseItemDetailProps) => close(props),
		[
			close,
		],
	);
};
