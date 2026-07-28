import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { readTileDeliveriesFx } from "~/bridge/tile/readTileDeliveriesFx";
import { settleItemDeliveryFx } from "~/engine/delivery/write/settleItemDeliveryFx";
import { useGameFx } from "~/engine/game/fx/useGameFx";
import { autofillLineInputsFx } from "~/engine/input/write/autofillLineInputsFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import {
	inputRuntimeTestConfig,
	inputRuntimeToolbarTestConfig,
	sourceLocation,
	workshopLocation,
} from "~test/input/support/inputRuntimeTestConfig";

const game = {
	getResourceUrl: (resourceId: string) => `resource:${resourceId}`,
} as GameEngine;

describe("readTileDeliveriesFx", () => {
	it("projects persisted outbound and returning semantic endpoints", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:workshop",
					itemId: "workshop",
					location: workshopLocation,
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: sourceLocation(2),
					quantity: 7,
				});
				yield* autofillLineInputsFx({
					ownerItemId: "runtime:workshop",
					lineId: "line:workshop:build",
				});
				const outboundRuntime = yield* readRuntimeFx();
				const outbound = yield* readTileDeliveriesFx({
					game,
					runtime: outboundRuntime,
				});
				yield* settleItemDeliveryFx({
					itemId: "runtime:water",
					generation: 0,
				});
				const returning = yield* readTileDeliveriesFx({
					game,
					runtime: yield* readRuntimeFx(),
				});
				return {
					outbound,
					returning,
				};
			}).pipe(
				useGameFx({
					config: inputRuntimeTestConfig,
				}),
			),
		);

		expect(result.outbound).toMatchObject([
			{
				from: sourceLocation(2),
				generation: 0,
				item: {
					id: "runtime:water",
					location: sourceLocation(2),
					primaryAction: {
						kind: "none",
					},
					quantity: 7,
				},
				phase: "outbound",
				targetActorId: "runtime:workshop",
				to: workshopLocation,
			},
		]);
		expect(result.returning).toMatchObject([
			{
				from: workshopLocation,
				generation: 1,
				item: {
					id: "runtime:water",
					quantity: 4,
				},
				phase: "returning",
				to: sourceLocation(2),
			},
		]);
	});

	it("projects an Inventory delivery through the live Toolbar opener", () => {
		const openerLocation = {
			scope: "toolbar" as const,
			position: {
				x: 0,
				y: 0,
			},
		};
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:workshop",
					itemId: "workshop",
					location: workshopLocation,
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:inventory-opener",
					itemId: "inventory",
					location: openerLocation,
					quantity: 1,
				});
				yield* spawnItemFx({
					id: "runtime:inventory-water",
					itemId: "water",
					location: {
						scope: "inventory",
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 3,
				});
				yield* autofillLineInputsFx({
					ownerItemId: "runtime:workshop",
					lineId: "line:workshop:build",
				});
				return yield* readTileDeliveriesFx({
					game,
					runtime: yield* readRuntimeFx(),
				});
			}).pipe(
				useGameFx({
					config: inputRuntimeToolbarTestConfig,
				}),
			),
		);

		expect(result).toMatchObject([
			{
				from: openerLocation,
				item: {
					id: "runtime:inventory-water",
					location: openerLocation,
					quantity: 3,
				},
				phase: "outbound",
				targetActorId: "runtime:workshop",
				to: workshopLocation,
			},
		]);
	});
});
