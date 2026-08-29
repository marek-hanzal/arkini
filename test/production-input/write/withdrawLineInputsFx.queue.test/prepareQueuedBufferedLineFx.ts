import { Effect } from "effect";

import { storeInputMaterialFx } from "~/production-input/write/storeInputMaterialFx";
import { enqueueLineFx } from "~/production-job/write/enqueueLineFx";
import { getItemFx } from "~test/support/runtime/getItemFx";
import { spawnItemFx } from "~test/support/runtime/spawnItemFx";
import { GameConfigSchema } from "~/game-config/GameConfigSchema";
import {
	inputRuntimeTestConfig,
	sourceLocation,
	workshopLocation,
} from "~test/production-input/support/inputRuntimeTestConfig";

export const ownerItemId = "runtime:workshop";
export const otherOwnerItemId = "runtime:other-workshop";
export const lineId = "line:workshop:build";

const workshop = inputRuntimeTestConfig.items.workshop;
if (workshop.type !== "producer")
	throw new Error("Expected the Workshop fixture to be a producer.");

export const queuedInputTestConfig = GameConfigSchema.parse({
	...inputRuntimeTestConfig,
	items: {
		...inputRuntimeTestConfig.items,
		workshop: {
			...workshop,
			maxQueueSize: 3,
		},
	},
});

/** Creates buffered material and interleaved global queue intent for two owners. */
export const prepareQueuedBufferedLineFx = Effect.fn("prepareQueuedBufferedLineFx")(function* () {
	yield* spawnItemFx({
		id: ownerItemId,
		itemId: "workshop",
		location: workshopLocation,
		quantity: 1,
	});
	yield* spawnItemFx({
		id: otherOwnerItemId,
		itemId: "workshop",
		location: sourceLocation(3),
		quantity: 1,
	});
	yield* spawnItemFx({
		id: "runtime:queued-water",
		itemId: "water",
		location: sourceLocation(1),
		quantity: 3,
	});
	const water = yield* getItemFx({
		itemId: "runtime:queued-water",
	});
	yield* storeInputMaterialFx({
		ownerItemId,
		lineId,
		inputIndex: 0,
		sourceItemId: water.id,
		sourceItemRevision: water.revision,
		quantity: 3,
	});
	const first = yield* enqueueLineFx({
		ownerItemId,
		lineId,
	});
	const other = yield* enqueueLineFx({
		ownerItemId: otherOwnerItemId,
		lineId,
	});
	const second = yield* enqueueLineFx({
		ownerItemId,
		lineId,
	});
	return {
		firstRequestId: first.id,
		globalRequestIds: [
			first.id,
			other.id,
			second.id,
		],
		secondRequestId: second.id,
	};
});
