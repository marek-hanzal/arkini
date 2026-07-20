import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { resolveJobRunnableFx } from "~/engine/job/fx/resolveJobRunnableFx";
import { resolveLineStartFx } from "~/engine/job/fx/read/resolveLineStartFx";
import { isLineOwnerItem } from "~/engine/line/read/isLineOwnerItem";
import { readLineOwnerLines } from "~/engine/line/read/readLineOwnerLines";
import { isPassiveStorageLocation } from "~/engine/location/read/isPassiveStorageLocation";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace readItemDetailStatusFx {
	export interface Props {
		readonly itemId: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}

	export type PassiveLocation = "inventory" | "toolbar";

	export type OperationalState =
		| {
				readonly kind: "idle";
		  }
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
} as const satisfies readItemDetailStatusFx.Result;

const passiveLocation = (scope: "inventory" | "toolbar"): readItemDetailStatusFx.PassiveLocation =>
	scope;

/** Projects the current owner-level operational condition of one exact line owner. */
export const readItemDetailStatusFx = Effect.fn("readItemDetailStatusFx")(function* ({
	itemId,
	runtime,
}: readItemDetailStatusFx.Props) {
	const item = runtime.items.find((candidate) => candidate.id === itemId);
	if (item === undefined || !isLineOwnerItem(item.item)) return unavailable;

	const job = runtime.jobs.find((candidate) => candidate.ownerItemId === item.id);
	let state: readItemDetailStatusFx.OperationalState;
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
		let ready = false;
		for (const line of readLineOwnerLines(item.item)) {
			const start = yield* resolveLineStartFx({
				lineId: line.id,
				ownerItemId: item.id,
				runtime,
			});
			if (start.run.show && start.ready) {
				ready = true;
				break;
			}
		}
		state = {
			kind: ready ? "ready" : "idle",
		};
	}

	return {
		kind: "available",
		itemId: item.id,
		title: item.item.title,
		state,
	} satisfies readItemDetailStatusFx.Result;
});
