import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { GameEngine } from "~/playable-game/type/GameEngine";
import { readTileDeliveriesFx } from "~/game-scene/fx/readTileDeliveriesFx";
import { useGameFx } from "~test/support/useGameFx";
import { autofillLineInputsFx } from "~test/support/autofillLineInputsFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import {
	inputRuntimeTestConfig,
	sourceLocation,
	workshopLocation,
} from "~test/production-input/support/inputRuntimeTestConfig";

const game = {
	getResourceUrlFn: (resourceId: string) => `resource:${resourceId}`,
} as GameEngine;

describe("readTileDeliveriesFx", () => {
	it("projects persisted outbound and returning semantic endpoints", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* spawnItemFx({
					id: "runtime:workshop",
					itemUid: "workshop",
					location: workshopLocation,
				});
				yield* spawnItemFx({
					id: "runtime:water",
					itemUid: "water",
					location: sourceLocation(2),
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
				const returning = yield* readTileDeliveriesFx({
					game,
					runtime: {
						...outboundRuntime,
						items: outboundRuntime.items.map((item) =>
							item.location.scope === "delivery"
								? {
										...item,
										location: {
											scope: "delivery",
											phase: "returning",
											generation: 1,
											remainingDurationMs: 300,
											origin: item.location.origin,
											returnFrom: workshopLocation,
										},
									}
								: item,
						),
					},
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
				remainingDurationMs: 300,
				item: {
					id: "runtime:water",
					location: sourceLocation(2),
					primaryAction: {
						kind: "none",
					},
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
				remainingDurationMs: 300,
				item: {
					id: "runtime:water",
				},
				phase: "returning",
				to: sourceLocation(2),
			},
		]);
	});
});
