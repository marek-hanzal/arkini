import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import type { EditorItemOriginFlowLayoutPoint } from "~/ui/item/editor/editorItemOriginFlowLayout";
import { readEditorOriginFlowMetroBackbonesFx } from "~/ui/item/editor/readEditorOriginFlowMetroBackbonesFx";

const route = (
	...points: ReadonlyArray<
		readonly [
			number,
			number,
		]
	>
) =>
	points.map(
		([x, y]): EditorItemOriginFlowLayoutPoint => ({
			x,
			y,
		}),
	);

const expectOrthogonal = (points: ReadonlyArray<EditorItemOriginFlowLayoutPoint>) => {
	for (let index = 1; index < points.length; index += 1) {
		const previous = points[index - 1]!;
		const current = points[index]!;
		expect(previous.x === current.x || previous.y === current.y).toBe(true);
	}
};

describe("readEditorOriginFlowMetroBackbonesFx", () => {
	it("draws shared highlighted trunks on parallel stable lanes while preserving ports", () => {
		const backbones = new Map([
			[
				"a",
				route(
					[
						0,
						0,
					],
					[
						100,
						0,
					],
					[
						100,
						100,
					],
					[
						500,
						100,
					],
					[
						500,
						200,
					],
					[
						600,
						200,
					],
				),
			],
			[
				"b",
				route(
					[
						0,
						20,
					],
					[
						100,
						20,
					],
					[
						100,
						100,
					],
					[
						500,
						100,
					],
					[
						500,
						220,
					],
					[
						600,
						220,
					],
				),
			],
		]);
		const metro = Effect.runSync(
			readEditorOriginFlowMetroBackbonesFx(backbones, [
				"b",
				"a",
			]),
		);
		const a = metro.get("a")!;
		const b = metro.get("b")!;

		expect(a[0]).toEqual(backbones.get("a")![0]);
		expect(a.at(-1)).toEqual(backbones.get("a")!.at(-1));
		expect(b[0]).toEqual(backbones.get("b")![0]);
		expect(b.at(-1)).toEqual(backbones.get("b")!.at(-1));
		expectOrthogonal(a);
		expectOrthogonal(b);

		expect(a[2]!.y).toBe(95);
		expect(a[3]!.y).toBe(95);
		expect(b[2]!.y).toBe(105);
		expect(b[3]!.y).toBe(105);
	});

	it("keeps unique highlighted routes on the bundled centerline", () => {
		const original = route(
			[
				0,
				0,
			],
			[
				100,
				0,
			],
			[
				100,
				100,
			],
			[
				500,
				100,
			],
			[
				500,
				200,
			],
			[
				600,
				200,
			],
		);
		const metro = Effect.runSync(
			readEditorOriginFlowMetroBackbonesFx(
				new Map([
					[
						"only",
						original,
					],
				]),
				[
					"only",
				],
			),
		);
		expect(metro.get("only")).toEqual(original);
	});

	it("compresses wide bundles instead of growing without bound", () => {
		const backbones = new Map<string, ReadonlyArray<EditorItemOriginFlowLayoutPoint>>();
		const ids: string[] = [];
		for (let index = 0; index < 21; index += 1) {
			const id = `edge-${index.toString().padStart(2, "0")}`;
			ids.push(id);
			backbones.set(
				id,
				route(
					[
						0,
						index,
					],
					[
						100,
						index,
					],
					[
						100,
						100,
					],
					[
						500,
						100,
					],
					[
						500,
						200 + index,
					],
					[
						600,
						200 + index,
					],
				),
			);
		}
		const metro = Effect.runSync(readEditorOriginFlowMetroBackbonesFx(backbones, ids));
		const sharedYs = ids.map((id) => metro.get(id)![2]!.y);
		expect(Math.min(...sharedYs)).toBeGreaterThanOrEqual(58);
		expect(Math.max(...sharedYs)).toBeLessThanOrEqual(142);
		expect(new Set(sharedYs).size).toBe(21);
	});
});
