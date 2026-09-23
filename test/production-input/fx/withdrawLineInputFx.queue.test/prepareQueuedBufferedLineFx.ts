import { Effect } from "effect";

import { bufferInputMaterialForTestFx } from "~test/support/bufferInputMaterialForTestFx";
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
export const lineUid = "line:workshop:build";

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
		itemUid: "workshop",
		location: workshopLocation,
	});
	yield* spawnItemFx({
		id: otherOwnerItemId,
		itemUid: "workshop",
		location: sourceLocation(3),
	});
	for (let index = 0; index < 3; index++) {
		yield* spawnItemFx({
			id: `runtime:queued-water:${index}`,
			itemUid: "water",
			location: sourceLocation(1),
		});
		const water = yield* getItemFx({
			itemId: `runtime:queued-water:${index}`,
		});
		yield* bufferInputMaterialForTestFx({
			ownerItemId,
			lineUid,
			inputIndex: 0,
			sourceItemId: water.id,
			sourceItemRevision: water.revision,
		});
	}

	const first = yield* enqueueLineFx({
		ownerItemId,
		lineUid,
	});
	const other = yield* enqueueLineFx({
		ownerItemId: otherOwnerItemId,
		lineUid,
	});
	const second = yield* enqueueLineFx({
		ownerItemId,
		lineUid,
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
