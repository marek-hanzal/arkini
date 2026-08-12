import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { OutputResolutionFx } from "~/engine/output/context/OutputResolutionFx";
import { outputFx } from "~/engine/output/fx/outputFx";
import { resolveOutputFx } from "~/engine/output/fx/resolveOutputFx";
import { useGameFx } from "~/engine/game/fx/useGameFx";
import {
	boardLocation,
	configuredDrop,
	configuredOutput,
	placementTestConfig,
} from "~test/placement/fx/support/placementTestConfig";

describe("OutputResolutionFx", () => {
	it("uses canonical resolution by default and permits a scoped override", () => {
		const output = configuredOutput([
			configuredDrop({
				itemId: "log",
				placement: "drop",
				quantity: 2,
			}),
		]);
		const props = {
			origin: boardLocation(0),
			output,
		};
		const result = Effect.runSync(
			Effect.gen(function* () {
				const canonical = yield* outputFx(props);
				const resolved = yield* resolveOutputFx(props);
				const overridden = yield* resolveOutputFx(props).pipe(
					Effect.provideService(OutputResolutionFx, {
						resolve: () =>
							Effect.succeed({
								drop: [
									{
										itemId: "override",
										placement: "random",
										quantity: 7,
									},
								],
							}),
					}),
				);
				return {
					canonical,
					overridden,
					resolved,
				};
			}).pipe(
				useGameFx({
					config: placementTestConfig,
				}),
			),
		);

		expect(result.resolved).toEqual(result.canonical);
		expect(result.overridden).toEqual({
			drop: [
				{
					itemId: "override",
					placement: "random",
					quantity: 7,
				},
			],
		});
	});
});
