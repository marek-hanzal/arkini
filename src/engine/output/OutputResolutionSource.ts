import type { IdSchema } from "~/engine/common/schema/IdSchema";

/** Stable authored source of one output resolution request. */
export type OutputResolutionSource =
	| {
			readonly itemId: IdSchema.Type;
			readonly type: "charges";
	  }
	| {
			readonly lineId: IdSchema.Type;
			readonly ownerItemId: IdSchema.Type;
			readonly type: "line";
	  }
	| {
			readonly sourceItemId: IdSchema.Type;
			readonly targetItemId: IdSchema.Type;
			readonly type: "merge";
	  }
	| {
			readonly itemId: IdSchema.Type;
			readonly type: "temporary-expiry";
	  };

/** Collision-free identity used by output policy implementations. */
export const readOutputResolutionSourceId = (source: OutputResolutionSource) => {
	switch (source.type) {
		case "charges":
		case "temporary-expiry":
			return JSON.stringify([
				source.type,
				source.itemId,
			]);
		case "line":
			return JSON.stringify([
				source.type,
				source.ownerItemId,
				source.lineId,
			]);
		case "merge":
			return JSON.stringify([
				source.type,
				source.sourceItemId,
				source.targetItemId,
			]);
	}
};
