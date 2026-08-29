import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readAboutPortraitResourcesFn } from "~/ui/launcher/about/fn/readAboutPortraitResourcesFn";
import { makeAboutPortraitPayloadFx } from "~test/ui/launcher/about/support/makeAboutPortraitPayloadFx";

describe("readAboutPortraitResourcesFn", () => {
	it("returns only configured resolvable avatars in stable anonymous slot order", () => {
		const payload = Effect.runSync(
			makeAboutPortraitPayloadFx({
				roles: {
					"avatar-01": "avatar:three",
					"avatar-02": "avatar:one",
					"avatar-03": "avatar:two",
					"avatar-04": "avatar:five",
					"avatar-05": "avatar:four",
					"avatar-06": "avatar:seven",
					"avatar-07": "avatar:six",
				},
			}),
		);
		expect(readAboutPortraitResourcesFn(payload).map(({ id }) => id)).toEqual([
			"avatar:three",
			"avatar:one",
			"avatar:two",
			"avatar:five",
			"avatar:four",
			"avatar:seven",
			"avatar:six",
		]);
	});

	it("skips absent slots and resolves zero or one avatar without placeholders", () => {
		expect(
			Effect.runSync(
				makeAboutPortraitPayloadFx({
					roles: {},
				}).pipe(Effect.map(readAboutPortraitResourcesFn)),
			),
		).toEqual([]);
		expect(
			Effect.runSync(
				makeAboutPortraitPayloadFx({
					roles: {
						"avatar-02": "avatar:two",
					},
				}).pipe(Effect.map(readAboutPortraitResourcesFn)),
			).map(({ id }) => id),
		).toEqual([
			"avatar:two",
		]);
	});
});
