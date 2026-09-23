import { Effect, Result } from "effect";
import { expect, it } from "vitest";

import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import { RuntimeIdentityFx } from "~/runtime-identity/context/RuntimeIdentityFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { planDropPlacementFx } from "~/item-placement/fx/planDropPlacementFx";
import {
	boardLocation,
	placementTestConfig,
} from "~test/item-placement/support/placementTestConfig";

it("rejects insufficient board capacity before allocating identities, including return leases and exclusions", () => {
	let identities = 0;
	const item = {
		id: "origin",
		item: placementTestConfig.items.origin,

		revision: "revision",
	};
	const runtime: RuntimeSchema.Type = {
		cheats: {
			enabled: false,
			everEnabled: false,
			speedUpGameplay: false,
		},
		currentSpace: 0,
		templateUidBySpace: {},
		jobs: [],
		jobQueue: [],
		defaultLineByOwnerItemId: {},
		items: [
			{
				...item,
				location: boardLocation(0),
			},
			{
				...item,
				id: "travelling",
				location: {
					scope: "delivery",
					phase: "returning",
					generation: 0,
					origin: boardLocation(1),
					returnFrom: boardLocation(3),
					remainingDurationMs: 100,
				},
			},
			{
				...item,
				id: "other-space",
				location: {
					...boardLocation(3),
					space: 1,
				},
			},
		],
	};
	const props = {
		drop: {
			type: "item" as const,
			itemUid: "board-only",
			placement: "drop" as const,
			quantity: 2,
		},
		origin: boardLocation(0),
		runtime,
	};
	Effect.runSync(
		Effect.gen(function* () {
			const rejected = yield* Effect.result(
				planDropPlacementFx({
					...props,
					excludedLocations: [
						boardLocation(0),
						boardLocation(2),
						boardLocation(2),
					],
				}),
			);
			expect(Result.isFailure(rejected)).toBe(true);
			if (Result.isFailure(rejected))
				expect(rejected.failure).toMatchObject({
					_tag: "PlacementUnavailableError",
					reason: "board:full",
					remainingQuantity: 1,
				});
			expect(identities).toBe(0);
			const accepted = yield* planDropPlacementFx(props);
			expect(accepted.spawn.map((item) => item.location)).toEqual([
				boardLocation(2),
				boardLocation(3),
			]);
			expect(identities).toBe(4);
		}).pipe(
			Effect.provideService(GameConfigFx, placementTestConfig),
			Effect.provideService(
				RuntimeIdentityFx,
				Effect.sync(() => `identity-${++identities}`),
			),
		),
	);
});
