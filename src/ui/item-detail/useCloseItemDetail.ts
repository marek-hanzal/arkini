import { useAtom } from "@effect/atom-react";
import { useCallback } from "react";

import type { CloseItemDetailProps } from "~/ui/item-detail/ItemDetailControl";
import { useItemDetailControl } from "~/ui/item-detail/useItemDetailControl";
import { readSettledAsyncResultError } from "~/ui/reactivity/readSettledAsyncResultError";

/** Runs the controller-owned close command and surfaces lifecycle causes to the boundary. */
export const useCloseItemDetail = () => {
	const itemDetail = useItemDetailControl();
	const [result, close] = useAtom(itemDetail.closeAtom);
	readSettledAsyncResultError(result);
	return useCallback(
		(props?: CloseItemDetailProps) => close(props),
		[
			close,
		],
	);
};
