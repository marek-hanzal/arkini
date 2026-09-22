import { Effect } from "effect";

import { storeInputMaterialFx } from "~/production-input/fx/storeInputMaterialFx";
import { enqueueLineFx } from "~/production-job/fx/enqueueLineFx";
import { getItemFx } from "~test/support/getItemFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import {
	inputRuntimeTestConfig,
	sourceLocation,
	workshopLocation,
} from "~test/production-input/support/inputRuntimeTestConfig";

export const ownerItemId = "runtime:workshop";
export const otherOwnerItemId = "runtime:other-workshop";
export const lineId = "line:workshop:build";

const workshop = inputRuntimeTestConfig.items.workshop;

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
	});
	yield* spawnItemFx({
		id: otherOwnerItemId,
		itemId: "workshop",
		location: sourceLocation(3),
	});
	for (let index = 0; index < 3; index++) {
		yield* spawnItemFx({
			id: `runtime:queued-water:${index}`,
			itemId: "water",
			location: sourceLocation(1),
		});
		const water = yield* getItemFx({
			itemId: `runtime:queued-water:${index}`,
		});
		yield* storeInputMaterialFx({
			ownerItemId,
			lineId,
			inputIndex: 0,
			sourceItemId: water.id,
			sourceItemRevision: water.revision,
		});
	}

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
