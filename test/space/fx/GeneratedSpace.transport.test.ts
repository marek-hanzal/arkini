import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";
import { useGameFx } from "~test/support/useGameFx";
import {
	generatedSpaceTestConfigFn,
	generatedSpaceStateFn,
	enterGeneratedSpaceFx,
	mergeGeneratedSpaceItemsFx,
} from "~test/space/support/generatedSpaceTestConfig";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { CommittedTransitionsFx } from "~/game-runtime/context/CommittedTransitionsFx";

describe("Generated Space transport", () => {
	it("drops near the occupied center of a new template room and shares it with subsequent navigation", () => {
		const config = generatedSpaceTestConfigFn();
		config.templates![0]!.width = 5;
		config.templates![0]!.height = 3;
		config.templates![0]!.board[0]!.x = 2;
		config.templates![0]!.board[0]!.y = 1;
		const result = Effect.runSync(
			Effect.gen(function* () {
				yield* mergeGeneratedSpaceItemsFx("cargo", "first");
				const transported = yield* readRuntimeFx();
				const entered = yield* enterGeneratedSpaceFx("first");
				return {
					transported,
					entered,
				};
			}).pipe(
				useGameFx({
					config,
					state: generatedSpaceStateFn(),
				}),
			),
		);
		const room = result.transported.items.find((item) => item.id === "first")!.generatedSpace;
		expect(room).toBeDefined();
		expect(result.transported.currentSpace).toBe(0);
		expect(result.transported.previousSpace).toBeUndefined();
		expect(result.transported.items.find((item) => item.id === "cargo")?.location).toEqual({
			scope: "board",
			space: room,
			position: {
				x: 2,
				y: 0,
			},
		});
		expect(result.entered.currentSpace).toBe(room);
		expect(result.entered.items.map((item) => item.id)).toEqual(
			result.transported.items.map((item) => item.id),
		);
	});

	it("rolls back room creation, owner binding and transport when the initialized template is full", () => {
		const config = generatedSpaceTestConfigFn();
		config.templates![0]!.width = 1;
		const result = Effect.runSync(
			Effect.gen(function* () {
				const before = yield* (yield* CommittedTransitionsFx).read;
				const attempt = yield* mergeGeneratedSpaceItemsFx("cargo", "first").pipe(
					Effect.result,
				);
				return {
					before,
					attempt,
					after: yield* (yield* CommittedTransitionsFx).read,
				};
			}).pipe(
				useGameFx({
					config,
					state: generatedSpaceStateFn(),
				}),
			),
		);
		expect(Result.isFailure(result.attempt)).toBe(true);
		expect(result.after).toBe(result.before);
		expect(result.after.runtime.templateUidBySpace).toEqual({});
		expect(
			result.after.runtime.items.find((item) => item.id === "first")?.generatedSpace,
		).toBeUndefined();
	});

	it("preserves the room and contents when a replacement retains the owner identity", () => {
		const state = generatedSpaceStateFn([
			{
				id: "first",
				itemUid: "warehouse",
				x: 0,
			},
			{
				id: "upgrade",
				itemUid: "upgrade",
				x: 1,
			},
		]);
		const result = Effect.runSync(
			Effect.gen(function* () {
				const before = yield* enterGeneratedSpaceFx("first");
				yield* mergeGeneratedSpaceItemsFx("upgrade", "first");
				return {
					before,
					after: yield* enterGeneratedSpaceFx("first"),
				};
			}).pipe(
				useGameFx({
					config: generatedSpaceTestConfigFn(),
					state,
				}),
			),
		);
		expect(result.after.items.find((item) => item.id === "first")?.generatedSpace).toBe(
			result.before.currentSpace,
		);
		expect(result.after.currentSpace).toBe(result.before.currentSpace);
		expect(
			result.after.items
				.filter(
					(item) =>
						item.location.scope === "board" &&
						item.location.space === result.before.currentSpace,
				)
				.map((item) => item.id),
		).toEqual(
			result.before.items
				.filter(
					(item) =>
						item.location.scope === "board" &&
						item.location.space === result.before.currentSpace,
				)
				.map((item) => item.id),
		);
	});
});
