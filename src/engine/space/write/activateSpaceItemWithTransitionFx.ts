import { Effect } from "effect";

import { modifyRuntimeWithTransitionFx } from "~/engine/runtime/internal/modifyRuntimeWithTransitionFx";
import { applySpaceItemActivationFx } from "~/engine/space/internal/applySpaceItemActivationFx";
import type { activateSpaceItemFx } from "~/engine/space/write/activateSpaceItemFx";

/** Returns the exact transition causally committed by this accepted Space action. */
export const activateSpaceItemWithTransitionFx = Effect.fn("activateSpaceItemWithTransitionFx")(
	(props: activateSpaceItemFx.Props) =>
		modifyRuntimeWithTransitionFx((runtime) =>
			applySpaceItemActivationFx({
				...props,
				runtime,
			}),
		),
);
