import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { GameEngine } from "~/bridge/game/GameEngine";
import { readTileDeliveriesFx } from "~/bridge/tile/readTileDeliveriesFx";
import { settleItemDeliveryFx } from "~/engine/delivery/write/settleItemDeliveryFx";
import { useGameFx } from "~/engine/game/fx/useGameFx";
import { autofillLineInputsFx } from "~/engine/input/write/autofillLineInputsFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
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

	it("keeps an Inventory delivery compact while projecting through a Board opener", () => {
		const openerLocation = {
			scope: "board" as const,
			space: 0,
			position: {
				x: 4,
				y: 0,
			},
		};
		const config = GameConfigSchema.parse({
			...inputRuntimeToolbarTestConfig,
			items: {
				...inputRuntimeToolbarTestConfig.items,
				water: {
					...inputRuntimeToolbarTestConfig.items.water,
					footprint: {
						height: 2,
						width: 2,
					},
				},
			},
		});
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
					quantity: 7,
				});
				yield* autofillLineInputsFx({
					ownerItemId: "runtime:workshop",
					lineId: "line:workshop:build",
				});
				const outbound = yield* readTileDeliveriesFx({
					game,
					runtime: yield* readRuntimeFx(),
				});
				yield* settleItemDeliveryFx({
					itemId: "runtime:inventory-water",
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
					config,
				}),
			),
		);

		expect(result.outbound).toMatchObject([
			{
				from: openerLocation,
				fromFootprint: {
					height: 1,
					width: 1,
				},
				item: {
					footprint: {
						height: 1,
						width: 1,
					},
					id: "runtime:inventory-water",
					location: openerLocation,
					quantity: 7,
				},
				phase: "outbound",
				targetActorId: "runtime:workshop",
				to: workshopLocation,
				toFootprint: {
					height: 2,
					width: 2,
				},
			},
		]);
		expect(result.returning).toMatchObject([
			{
				from: workshopLocation,
				fromFootprint: {
					height: 2,
					width: 2,
				},
				phase: "returning",
				to: openerLocation,
				toFootprint: {
					height: 1,
					width: 1,
				},
			},
		]);
	});
});
