import { LineSchema } from "~/production-line/schema/LineSchema";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { useGameFx } from "~test/support/useGameFx";
import {
	generatedSpaceTestConfigFn,
	generatedSpaceStateFn,
	enterGeneratedSpaceFx,
	removeGeneratedSpaceItemFx,
} from "~test/space/support/generatedSpaceTestConfig";
import { fromRuntimeFn } from "~/game-persistence/fn/fromRuntimeFn";
import { StateSchema } from "~/game-persistence/schema/StateSchema";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { readBoardSizeFn } from "~/game-runtime/fn/readBoardSizeFn";

describe("Generated Space", () => {
	it("binds separate rooms to identical owners and reuses edited contents across visits and save/load", () => {
		const config = generatedSpaceTestConfigFn();
		const result = Effect.runSync(
			Effect.gen(function* () {
				const before = yield* readRuntimeFx();
				const first = yield* enterGeneratedSpaceFx("first");
				const originalToken = first.items.find(
					(item) =>
						item.location.scope === "board" &&
						item.location.space === first.currentSpace,
				)!;
				yield* removeGeneratedSpaceItemFx(originalToken.id);
				const repeated = yield* enterGeneratedSpaceFx("first");
				const second = yield* enterGeneratedSpaceFx("second");
				return {
					before,
					first,
					originalToken,
					repeated,
					second,
				};
			}).pipe(
				useGameFx({
					config,
					state: generatedSpaceStateFn(),
				}),
			),
		);
		expect(result.before.items.every((item) => item.generatedSpace === undefined)).toBe(true);
		expect(result.before.templateUidBySpace).toEqual({});
		expect(result.first.currentSpace).not.toBe(0);
		expect(result.first.items.find((item) => item.id === "first")?.generatedSpace).toBe(
			result.first.currentSpace,
		);
		expect(result.repeated.currentSpace).toBe(result.first.currentSpace);
		expect(result.repeated.items.some((item) => item.id === result.originalToken.id)).toBe(
			false,
		);
		expect(
			result.repeated.items.filter(
				(item) =>
					item.location.scope === "board" &&
					item.location.space === result.first.currentSpace,
			),
		).toEqual([]);
		expect(result.second.currentSpace).not.toBe(result.first.currentSpace);
		expect(
			readBoardSizeFn({
				config,
				runtime: result.second,
				space: result.second.currentSpace,
			}),
		).toEqual({
			width: 2,
			height: 1,
		});
		const secondToken = result.second.items.find(
			(item) =>
				item.location.scope === "board" &&
				item.location.space === result.second.currentSpace,
		)!;
		expect(secondToken.id).not.toBe(result.originalToken.id);
		const state = StateSchema.parse(
			JSON.parse(
				JSON.stringify(
					fromRuntimeFn({
						runtime: result.second,
					}),
				),
			),
		);
		const loaded = Effect.runSync(
			Effect.gen(function* () {
				const before = yield* readRuntimeFx();
				const after = yield* enterGeneratedSpaceFx("second");
				return {
					before,
					after,
				};
			}).pipe(
				useGameFx({
					config,
					state,
				}),
			),
		);
		expect(
			loaded.before.items.map((item) => [
				item.id,
				item.generatedSpace,
			]),
		).toEqual(
			result.second.items.map((item) => [
				item.id,
				item.generatedSpace,
			]),
		);
		expect(loaded.after.currentSpace).toBe(result.second.currentSpace);
		expect(loaded.after.items.map((item) => item.id)).toEqual(
			result.second.items.map((item) => item.id),
		);
	});

	it("reserves empty authored destinations before allocating a generated address", () => {
		const config = generatedSpaceTestConfigFn();
		config.items.token!.merge = [
			{
				action: "space",
				space: 1,
				effect: "keep",
			},
		];
		config.items.upgrade!.lines = [
			LineSchema.parse({
				...config.items.warehouse!.lines[0]!,
				uid: "fixed",
				title: "Fixed",
				description: "Fixed",
				runtimeMs: 0,
				input: [
					{
						type: "simple",
					},
				],
				rules: [],
				outcome: {
					set: [
						{
							rules: [],
							roll: [
								{
									type: "guaranteed",
									outcome: [
										{
											type: "space",
											space: 2,
											rules: [],
										},
									],
								},
							],
						},
					],
				},
			}),
		];
		const runtime = Effect.runSync(
			enterGeneratedSpaceFx("first").pipe(
				useGameFx({
					config,
					state: generatedSpaceStateFn(),
				}),
			),
		);
		expect([
			0,
			1,
			2,
		]).not.toContain(runtime.currentSpace);
		expect(runtime.items.find((item) => item.id === "first")?.generatedSpace).toBe(
			runtime.currentSpace,
		);
	});
});
