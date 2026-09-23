import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { createDropPresentationFx } from "~/tile-interaction/fx/createDropPresentationFx";

describe("drop presentation", () => {
	it("settles only the matching pending generation", () => {
		const presentation = Effect.runSync(createDropPresentationFx());
		const first = Effect.runSync(presentation.beginFx("runtime:source"));
		const second = Effect.runSync(presentation.beginFx("runtime:source"));
		Effect.runSync(presentation.settleFx(first));
		expect(Effect.runSync(presentation.isPendingActorFx("runtime:source"))).toBe(true);
		Effect.runSync(presentation.settleFx(second));
		expect(Effect.runSync(presentation.isPendingActorFx("runtime:source"))).toBe(false);
	});
});
