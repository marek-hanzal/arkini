import { Effect, Random } from "effect";
import { describe, expect, it } from "vitest";

import { resolveBoardPlacementOriginFx } from "~/v1/placement/fx/resolveBoardPlacementOriginFx";

describe("resolveBoardPlacementOriginFx", () => {
	it("keeps the configured origin without consuming randomness for drop placement", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const origin = yield* resolveBoardPlacementOriginFx({
					origin: {
						scope: "board",
						space: 3,
						position: {
							x: 7,
							y: 8,
						},
					},
					placement: "drop",
					size: {
						width: 4,
						height: 2,
					},
				});
				const nextRandom = yield* Random.next;

				return {
					nextRandom,
					origin,
				};
			}).pipe(
				Effect.withRandom(
					Random.fixed([
						0.75,
					]),
				),
			),
		);

		expect(result).toEqual({
			nextRandom: 0.75,
			origin: {
				scope: "board",
				space: 3,
				position: {
					x: 7,
					y: 8,
				},
			},
		});
	});

	it("chooses one random origin from every board position and consumes one draw", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const origin = yield* resolveBoardPlacementOriginFx({
					origin: {
						scope: "board",
						space: 3,
						position: {
							x: 7,
							y: 8,
						},
					},
					placement: "random",
					size: {
						width: 4,
						height: 2,
					},
				});
				const nextRandom = yield* Random.next;

				return {
					nextRandom,
					origin,
				};
			}).pipe(
				Effect.withRandom(
					Random.fixed([
						5,
						0.75,
					]),
				),
			),
		);

		expect(result).toEqual({
			nextRandom: 0.75,
			origin: {
				scope: "board",
				space: 3,
				position: {
					x: 1,
					y: 1,
				},
			},
		});
	});
});
