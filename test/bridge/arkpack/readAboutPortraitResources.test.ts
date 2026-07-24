import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { readAboutPortraitResourcesFx } from "~/bridge/arkpack/readAboutPortraitResourcesFx";
import { makeAboutPortraitPayloadFx } from "~test/bridge/arkpack/support/makeAboutPortraitPayloadFx";

describe("readAboutPortraitResourcesFx", () => {
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
		expect(Effect.runSync(readAboutPortraitResourcesFx(payload)).map(({ id }) => id)).toEqual([
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
				}).pipe(Effect.flatMap(readAboutPortraitResourcesFx)),
			),
		).toEqual([]);
		expect(
			Effect.runSync(
				makeAboutPortraitPayloadFx({
					roles: {
						"avatar-02": "avatar:two",
					},
				}).pipe(Effect.flatMap(readAboutPortraitResourcesFx)),
			).map(({ id }) => id),
		).toEqual([
			"avatar:two",
		]);
	});
});
