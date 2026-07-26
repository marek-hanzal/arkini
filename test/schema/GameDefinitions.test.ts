import { describe, expect, it } from "vitest";

import { readArkiniGameSources } from "~test/schema/support/readArkiniGameSources";

describe("game definitions", () => {
	it("guarantees one lumberjack log and preserves higher-tier bonus chances", () => {
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
							readonly chance?: number;
							readonly drop: readonly {
								readonly itemId: string;
							}[];
							readonly type: "chance" | "guaranteed";
						}[];
					}[];
				};
			}[];
		};

		expect(
			lumberjack.lines.map((line) => ({
				logRolls: line.output.set[0].roll
					.filter((roll) => roll.drop.some(({ itemId }) => itemId === "item:log"))
					.map(({ chance, type }) => ({
						chance,
						type,
					})),
				sourceItemId: line.input[0].query.selector.itemId,
			})),
		).toEqual([
			{
				logRolls: [
					{
						chance: undefined,
						type: "guaranteed",
					},
				],
				sourceItemId: "item:tree",
			},
			{
				logRolls: [
					{
						chance: undefined,
						type: "guaranteed",
					},
					{
						chance: 0.65,
						type: "chance",
					},
				],
				sourceItemId: "item:double-tree",
			},
			{
				logRolls: [
					{
						chance: undefined,
						type: "guaranteed",
					},
					{
						chance: 0.85,
						type: "chance",
					},
				],
				sourceItemId: "item:micro-forest",
			},
		]);
	});
});
