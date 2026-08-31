import { Effect } from "effect";
import { describe, expect, it } from "@effect/vitest";

import { layoutFx } from "~/flow-layout/fx/layoutFx";
import type { LayoutInput } from "~/flow-layout/type/Layout";

const node = (id: string): LayoutInput["nodes"][number] => ({
	height: 120,
	id,
	ports: [],
	type: "simple",
	width: 240,
});

describe("layoutFx", () => {
	it.effect("assigns one stable order to every node in a feedback graph", () =>
		Effect.gen(function* () {
			const layout = yield* layoutFx({
				edges: [
					{
						id: "edge:a-b",
						source: "node:a",
						target: "node:b",
					},
					{
						id: "edge:b-a",
						source: "node:b",
						target: "node:a",
					},
					{
						id: "edge:b-b",
						source: "node:b",
						target: "node:b",
					},
				],
				nodes: [
					node("node:b"),
					node("node:a"),
				],
			});

			expect(
				[
					...layout.positions,
				].map(([id, position]) => [
					id,
					position.flowOrder,
				]),
			).toEqual([
				[
					"node:a",
					0,
				],
				[
					"node:b",
					1,
				],
			]);
			expect([
				...layout.backbones.keys(),
			]).toEqual([
				"edge:a-b",
				"edge:b-a",
				"edge:b-b",
			]);
		}),
	);
});
