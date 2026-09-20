import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
	createItem,
	mountController,
	pointer,
	previewTestState as previewState,
} from "~test/tile-interaction/fx/MainDragController.test/fixture";

describe("main drag controller: preview", () => {
	it("refreshes a stationary pointer target when its canonical identity changes", () => {
		const eligible = createItem("runtime:eligible", 1);
		const mounted = mountController({
			targetItems: [
				eligible,
			],
		});
		previewState.actorKinds.set(eligible.id, "merge");
		mounted.actorEvents.emit("pointerdown", pointer(10, 20));
		mounted.stage.emit("globalpointermove", pointer(30, 20));
		mounted.flushFrame();
		expect(previewState.readsByActorId.get(eligible.id)).toBeUndefined();

		mounted.setOccupant(eligible);
		mounted.setCommandTarget({
			kind: "slot",
			location: eligible.location,
			occupant: {
				itemId: eligible.id,
				revision: eligible.revision,
			},
		});
		Effect.runSync(mounted.controller.requestRefreshFx);
		mounted.flushFrame();

		expect(previewState.readsByActorId.get(eligible.id)).toBe(1);
	});
});
