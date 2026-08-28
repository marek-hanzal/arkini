import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import type { GridLocationSchema } from "~/engine/location/schema/GridLocationSchema";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import { applySpaceItemActivationFx } from "~/engine/space/internal/applySpaceItemActivationFx";

export namespace activateSpaceItemFx {
	export interface Props {
		currentSpace: NonNegativeIntegerSchema.Type;
		itemId: IdSchema.Type;
		location: GridLocationSchema.Type;
		revision: RevisionSchema.Type;
	}
}

/** Settles one fresh Space action plan and navigation in one engine transaction. */
export const activateSpaceItemFx = Effect.fn("activateSpaceItemFx")(
	(props: activateSpaceItemFx.Props) =>
		modifyRuntimeFx((runtime) =>
			applySpaceItemActivationFx({
				...props,
				runtime,
			}),
		),
);
