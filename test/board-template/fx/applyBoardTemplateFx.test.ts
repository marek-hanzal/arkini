import { Effect, Result } from "effect";
import { expect, it } from "vitest";
import { applyBoardTemplateFx } from "~/board-template/fx/applyBoardTemplateFx";
import { RuntimeStoreFx } from "~/game-runtime/context/RuntimeStoreFx";
import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import { startFx } from "~/game-start/fx/startFx";
import { startTestConfig } from "~test/game-start/support/startTestConfig";
import { useGameFx } from "~test/support/useGameFx";

it("reapplying the same template replaces identities in one committed current-space reset", () => {
	const result = Effect.runSync(
		Effect.gen(function* () {
			const before = yield* startFx();
			const transitions = yield* RuntimeStoreFx;
			const started = yield* transitions.read;
			const next = yield* applyBoardTemplateFx({
				templateUid: "start",
			});
			const store = yield* RuntimeFx;
			return {
				before,
				next,
				stored: yield* store.read,
				started,
				committed: yield* transitions.read,
			};
		}).pipe(
			useGameFx({
				config: startTestConfig,
			}),
		),
	);
	expect(result.stored).toBe(result.next);
	const applied = {
		type: "board:template-applied",
		space: 0,
		templateUid: "start",
	};
	expect(result.started.events).toEqual([
		applied,
	]);
	expect(
		result.committed.events.filter((event) => event.type === "board:template-applied"),
	).toEqual([
		applied,
	]);
	expect(result.committed.sequence).toBe(result.started.sequence + 1);
	expect(result.next.items).toHaveLength(1);
	expect(result.next.items[0]?.id).not.toBe(result.before.items[0]?.id);
	expect(result.next.items[0]?.location).toEqual(result.before.items[0]?.location);
	expect(result.next.templateUidBySpace).toEqual({
		0: "start",
	});
});

it("rejects missing templates and failed replacement items without clearing the original board", () => {
	const config = {
		...startTestConfig,
		templates: [
			...startTestConfig.templates!,
			{
				uid: "broken",
				title: "Broken",
				width: 2,
				height: 2,
				board: [
					{
						itemId: "log",
						x: 0,
						y: 0,
					},
					{
						itemId: "missing",
						x: 1,
						y: 0,
					},
				],
			},
		],
	};
	const result = Effect.runSync(
		Effect.gen(function* () {
			const before = yield* startFx();
			const missing = yield* Effect.result(
				applyBoardTemplateFx({
					templateUid: "missing",
				}),
			);
			const broken = yield* Effect.result(
				applyBoardTemplateFx({
					templateUid: "broken",
				}),
			);
			const store = yield* RuntimeFx;
			return {
				before,
				missing,
				broken,
				after: yield* store.read,
			};
		}).pipe(
			useGameFx({
				config,
			}),
		),
	);
	expect(Result.isFailure(result.missing)).toBe(true);
	expect(Result.isFailure(result.broken)).toBe(true);
	expect(result.after).toBe(result.before);
});
