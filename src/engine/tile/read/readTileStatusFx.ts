import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { resolveJobRunnableFx } from "~/engine/job/fx/resolveJobRunnableFx";
import { isLineOwnerItem } from "~/engine/line/read/isLineOwnerItem";
import { isPassiveStorageLocation } from "~/engine/location/read/isPassiveStorageLocation";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace readTileStatusFx {
	export interface Props {
		readonly itemId: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}

	export type PassiveLocation = "inventory" | "toolbar";

	export type OperationalState =
		| {
				readonly kind: "ready";
		  }
		| {
				readonly kind: "working";
		  }
		| {
				readonly kind: "stored";
				readonly location: PassiveLocation;
		  }
		| {
				readonly kind: "paused";
				readonly reason:
					| {
							readonly kind: "passive-storage";
							readonly location: PassiveLocation;
					  }
					| {
							readonly kind: "dependencies";
					  };
		  };

	export type Result =
		| {
				readonly kind: "available";
				readonly itemId: IdSchema.Type;
				readonly title: string;
				readonly state: OperationalState;
		  }
		| {
				readonly kind: "unavailable";
		  };
}

const unavailable = {
	kind: "unavailable",
} as const satisfies readTileStatusFx.Result;

const passiveLocation = (scope: "inventory" | "toolbar"): readTileStatusFx.PassiveLocation => scope;

/** Projects the current owner-level operational condition of one exact line owner. */
export const readTileStatusFx = Effect.fn("readTileStatusFx")(function* ({
	itemId,
	runtime,
}: readTileStatusFx.Props) {
	const item = runtime.items.find((candidate) => candidate.id === itemId);
	if (item === undefined || !isLineOwnerItem(item.item)) return unavailable;

	const job = runtime.jobs.find((candidate) => candidate.ownerItemId === item.id);
	let state: readTileStatusFx.OperationalState;
	if (job !== undefined) {
		if (isPassiveStorageLocation(item.location)) {
			state = {
				kind: "paused",
				reason: {
					kind: "passive-storage",
					location: passiveLocation(item.location.scope),
				},
			};
		} else {
			const runnable = yield* resolveJobRunnableFx({
				job,
				runtime,
			});
			state = runnable
				? {
						kind: "working",
					}
				: {
						kind: "paused",
						reason: {
							kind: "dependencies",
						},
					};
		}
	} else if (isPassiveStorageLocation(item.location)) {
		state = {
			kind: "stored",
			location: passiveLocation(item.location.scope),
		};
	} else {
		state = {
			kind: "ready",
		};
	}

	return {
		kind: "available",
		itemId: item.id,
		title: item.item.title,
		state,
	} satisfies readTileStatusFx.Result;
});
