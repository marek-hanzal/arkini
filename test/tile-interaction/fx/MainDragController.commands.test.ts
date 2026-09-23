import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import {
	item,
	mountController,
	releaseOrdinaryDrag,
} from "~test/tile-interaction/fx/MainDragController.test/fixture";

describe("main drag controller: commands", () => {
	it("submits on pointer release and retains the exact pending actor until resolution", () => {
		const mounted = mountController();
		mounted.onDrop.mockReturnValueOnce(new Promise(() => undefined));

		releaseOrdinaryDrag(mounted);

		expect(mounted.onDrop).toHaveBeenCalledOnce();
		expect(Effect.runSync(mounted.dropPresentation.isPendingActorFx(item.id))).toBe(true);
	});
});
