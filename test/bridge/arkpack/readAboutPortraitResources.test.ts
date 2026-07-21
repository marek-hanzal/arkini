import { describe, expect, it } from "vitest";

import { readAboutPortraitResources } from "~/bridge/arkpack/readAboutPortraitResources";
import type { PayloadSchema } from "~/engine/pack/schema/PayloadSchema";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

const makePayload = ({
	roles,
}: {
	readonly roles: Partial<Record<"avatar-01" | "avatar-02" | "avatar-03", string>>;
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
			},
		});
		expect(readAboutPortraitResources(payload).map(({ id }) => id)).toEqual([
			"avatar:three",
			"avatar:one",
			"avatar:two",
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
