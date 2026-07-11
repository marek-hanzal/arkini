import { Effect, Random } from "effect";
import { describe, expect, it } from "vitest";

import { orderBoardLocationsFx } from "./orderBoardLocationsFx";

const location = (x: number, y = 0) => {
	return {
		position: {
			x,
			y,
		},
		scope: "board" as const,
	};
};

describe("orderBoardLocationsFx", () => {
	it("orders drop locations by Manhattan distance and scan-order ties", () => {
		const result = Effect.runSync(
			orderBoardLocationsFx({
				locations: [
					location(3),
					location(2),
					location(0),
				],
				origin: {
					x: 1,
					y: 0,
				},
				placement: "drop",
			}),
		);

		expect(result).toEqual([
			location(0),
			location(2),
			location(3),
		]);
	});

	it("shuffles random locations reproducibly for one seeded random service", () => {
		const run = () => {
			return Effect.runSync(
				orderBoardLocationsFx({
					locations: [
						location(0),
						location(1),
						location(2),
						location(3),
					],
					origin: {
						x: 0,
						y: 0,
					},
					placement: "random",
				}).pipe(Effect.withRandom(Random.make("placement-order"))),
			);
		};
		const first = run();
		const second = run();

		expect(second).toEqual(first);
		expect(
			[
				...first,
			].sort((left, right) => left.position.x - right.position.x),
		).toEqual([
			location(0),
			location(1),
			location(2),
			location(3),
		]);
	});
});
