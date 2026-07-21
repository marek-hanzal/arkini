import { describe, expect, it } from "vitest";

import { readAboutPortraitResources } from "~/bridge/arkpack/readAboutPortraitResources";
import type { PayloadSchema } from "~/engine/pack/schema/PayloadSchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

const makePayload = ({
	roles,
}: {
	readonly roles: Partial<
		Record<
			| "avatar-01"
			| "avatar-02"
			| "avatar-03"
			| "avatar-04"
			| "avatar-05"
			| "avatar-06"
			| "avatar-07",
			string
		>
	>;
}): PayloadSchema.Type => ({
	config: GameConfigSchema.parse({
		version: "1.0",
		resources: {
			hero: "hero",
			...roles,
		},
		meta: {
			id: "game:avatars",
			title: "Avatars",
			board: {
				width: 1,
				height: 1,
			},
			inventory: {
				width: 1,
				height: 1,
			},
		},
		start: {
			currentSpace: 0,
		},
		categories: {},
		items: {},
	}),
	resources: [
		"hero",
		"avatar:one",
		"avatar:two",
		"avatar:three",
		"avatar:four",
		"avatar:five",
		"avatar:six",
		"avatar:seven",
	].map((id) => ({
		id,
		mime: "image/png",
		bytes: new Uint8Array([
			1,
		]),
	})),
});

describe("readAboutPortraitResources", () => {
	it("returns only configured resolvable avatars in stable anonymous slot order", () => {
		const payload = makePayload({
			roles: {
				"avatar-01": "avatar:three",
				"avatar-02": "avatar:one",
				"avatar-03": "avatar:two",
				"avatar-04": "avatar:five",
				"avatar-05": "avatar:four",
				"avatar-06": "avatar:seven",
				"avatar-07": "avatar:six",
			},
		});
		expect(readAboutPortraitResources(payload).map(({ id }) => id)).toEqual([
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
			readAboutPortraitResources(
				makePayload({
					roles: {},
				}),
			),
		).toEqual([]);
		expect(
			readAboutPortraitResources(
				makePayload({
					roles: {
						"avatar-02": "avatar:two",
					},
				}),
			).map(({ id }) => id),
		).toEqual([
			"avatar:two",
		]);
	});
});
