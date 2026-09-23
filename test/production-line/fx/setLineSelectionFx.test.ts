import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import { setLineSelectionFx } from "~/production-line/fx/setLineSelectionFx";
import { readEffectiveLineFn } from "~/production-line/fn/readEffectiveLineFn";
import { checkRuntimeFx } from "~/game-runtime/fx/checkRuntimeFx";
import { fromStateFx } from "~/game-persistence/fx/fromStateFx";
import { removeRuntimeItemIdentityFx } from "~/game-runtime/fx/removeRuntimeItemIdentityFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { fromRuntimeFn } from "~/game-persistence/fn/fromRuntimeFn";
import { startFx } from "~/game-start/fx/startFx";
import { RuntimeCheckIssueEnumSchema } from "~/game-runtime/schema/RuntimeCheckIssueEnumSchema";
import { DefaultLineIssueReasonEnumSchema } from "~/production-line/schema/DefaultLineIssueReasonEnumSchema";

const line = (id: string, title: string, isDefault = false) => ({
	id,
	title,
	description: `${title} description.`,
	default: isDefault,
	show: true,
	enable: true,
	runtimeMs: 1_000,
	input: [
		{
			type: "simple" as const,
		},
	],
	rules: [],
});

const config = GameConfigSchema.parse({
	resources: {
		hero: "hero",
	},
	meta: {
		id: "game:default-line",
		title: "Default line",
		board: {
			width: 1,
			height: 1,
		},
	},
	templates: [
		{
			uid: "start",
			title: "Start",
			width: 1,
			height: 1,
			board: [
				{
					itemUid: "producer",
					x: 0,
					y: 0,
				},
			],
		},
	],
	start: {
		currentSpace: 0,
		spaces: [
			{
				space: 0,
				templateUid: "start",
			},
		],
	},
	items: {
		producer: {
			uid: "producer",

			title: "Producer",
			description: "Owns two lines.",
			ui: "default",
			artwork: {
				scale: 0.8,
				default: [
					"artwork:producer",
				],
			},

			maxQueueSize: 1,
			lines: [
				line("line:first", "First", true),
				line("line:second", "Second"),
			],
		},
	},
});

describe("setLineSelectionFx", () => {
	it("reads the authored fallback without creating runtime state", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const runtime = yield* startFx();
				const owner = runtime.items[0];
				if (owner === undefined) throw new Error("Missing producer.");
				return {
					effectiveLine: readEffectiveLineFn({
						ownerItemId: owner.id,
						ownerItem: owner.item,
						runtime,
					}),
					runtime,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.runtime.defaultLineByOwnerItemId).toEqual({});
		expect(result.effectiveLine?.id).toBe("line:first");
	});

	it("persists one exact default without reordering authored lines and makes the owner impure", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const started = yield* startFx();
				const owner = started.items[0];
				if (owner === undefined) throw new Error("Missing producer.");
				yield* setLineSelectionFx({
					selection: "default",
					ownerItemId: owner.id,
					lineId: "line:second",
				});
				const runtime = yield* readRuntimeFx();
				const state = fromRuntimeFn({
					runtime,
				});
				const restored = yield* fromStateFx({
					state,
				});
				return {
					owner,

					runtime,
					state,
					restored,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.runtime.defaultLineByOwnerItemId).toEqual({
			[result.owner.id]: "line:second",
		});
		expect(result.state.defaultLineByOwnerItemId).toEqual(
			result.runtime.defaultLineByOwnerItemId,
		);
		expect(result.restored.defaultLineByOwnerItemId).toEqual(
			result.runtime.defaultLineByOwnerItemId,
		);
	});

	it("persists an explicit no-default override instead of restoring the authored fallback", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const started = yield* startFx();
				const owner = started.items[0];
				if (owner === undefined) throw new Error("Missing producer.");
				yield* setLineSelectionFx({
					selection: "default",
					ownerItemId: owner.id,
					lineId: "line:second",
				});
				yield* setLineSelectionFx({
					lineId: null,
					selection: "default",
					ownerItemId: owner.id,
				});
				const runtime = yield* readRuntimeFx();
				const state = fromRuntimeFn({
					runtime,
				});
				const restored = yield* fromStateFx({
					state,
				});
				return {
					restored,
					runtime,
					state,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.runtime.defaultLineByOwnerItemId).toEqual({
			[result.runtime.items[0]!.id]: null,
		});
		expect(result.state.defaultLineByOwnerItemId).toEqual(
			result.runtime.defaultLineByOwnerItemId,
		);
		expect(result.restored.defaultLineByOwnerItemId).toEqual(
			result.runtime.defaultLineByOwnerItemId,
		);
	});

	it("rejects foreign lines and reports stale persisted selections", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const runtime = yield* startFx();
				const owner = runtime.items[0];
				if (owner === undefined) throw new Error("Missing producer.");
				const rejected = yield* Effect.result(
					setLineSelectionFx({
						selection: "default",
						ownerItemId: owner.id,
						lineId: "line:missing",
					}),
				);
				const checked = yield* checkRuntimeFx({
					runtime: {
						...runtime,
						defaultLineByOwnerItemId: {
							[owner.id]: "line:missing",
							"runtime:missing": "line:first",
						},
					},
				});
				return {
					checked,
					rejected,
				};
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(Result.isFailure(result.rejected)).toBe(true);
		if (Result.isFailure(result.rejected)) {
			expect(result.rejected.failure).toMatchObject({
				_tag: "LineNotFoundError",
				lineId: "line:missing",
			});
		}
		expect(result.checked.issues).toContainEqual({
			type: RuntimeCheckIssueEnumSchema.enum.DefaultLine,
			ownerItemId: expect.any(String),
			lineId: "line:missing",
			reason: DefaultLineIssueReasonEnumSchema.enum.LineMissing,
		});
		expect(result.checked.issues).toContainEqual({
			type: RuntimeCheckIssueEnumSchema.enum.DefaultLine,
			ownerItemId: "runtime:missing",
			lineId: "line:first",
			reason: DefaultLineIssueReasonEnumSchema.enum.OwnerMissing,
		});
	});

	it("removes the selection with the exact owner identity", () => {
		const result = Effect.runSync(
			Effect.gen(function* () {
				const started = yield* startFx();
				const owner = started.items[0];
				if (owner === undefined) throw new Error("Missing producer.");
				const selected = {
					...started,
					defaultLineByOwnerItemId: {
						[owner.id]: "line:first",
					},
				};
				return yield* removeRuntimeItemIdentityFx({
					item: owner,
					runtime: selected,
				});
			}).pipe(
				useGameFx({
					config,
				}),
			),
		);

		expect(result.runtime.items).toEqual([]);
		expect(result.runtime.defaultLineByOwnerItemId).toEqual({});
	});
});
