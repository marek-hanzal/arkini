import { describe, expect, it } from "vitest";

import { readArkiniGameSources } from "./test/readArkiniGameSources";

describe("game definitions", () => {
	it("preserves lumberjack output chances for every wood-source tier", () => {
		const lumberjack = readArkiniGameSources()
			.flatMap(({ value }) =>
				Object.values(
					(
						value as {
							readonly items?: Readonly<Record<string, unknown>>;
						}
					).items ?? {},
				),
			)
			.find(
				(item) =>
					(
						item as {
							readonly id?: string;
						}
					).id === "producer:lumberjack-t1",
			) as {
			readonly lines: readonly {
				readonly input: readonly {
					readonly query: {
						readonly selector: {
							readonly itemId: string;
						};
					};
				}[];
				readonly output: {
					readonly set: readonly {
						readonly roll: readonly {
							readonly chance: number;
						}[];
					}[];
				};
			}[];
		};

		expect(
			lumberjack.lines.map((line) => ({
				chance: line.output.set[0].roll[0].chance,
				sourceItemId: line.input[0].query.selector.itemId,
			})),
		).toEqual([
			{
				chance: 0.5,
				sourceItemId: "item:tree",
			},
			{
				chance: 0.65,
				sourceItemId: "item:double-tree",
			},
			{
				chance: 0.85,
				sourceItemId: "item:micro-forest",
			},
		]);
	});
});
