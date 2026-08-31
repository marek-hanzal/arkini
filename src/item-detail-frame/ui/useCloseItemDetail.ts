import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { useAtom } from "@effect/atom-react";
import { useCallback } from "react";

import type { CloseItemDetailProps } from "~/item-detail-frame/type/ItemDetailControl";
import { useItemDetailControl } from "~/item-detail-frame/ui/useItemDetailControl";
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
