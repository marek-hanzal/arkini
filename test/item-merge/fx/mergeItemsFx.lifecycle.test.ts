import { Effect, Option, Result } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/game/useGameFx";
import { applyMergeRuntimeFx } from "~/item-merge/fx/applyMergeRuntimeFx";
import type { MergeSchema } from "~/item-merge/schema/MergeSchema";
import { mergeItemsFx } from "~/item-merge/fx/mergeItemsFx";
import { readRuntimeFx } from "~/game-runtime/read/readRuntimeFx";
import { isBoardRuntimeItemFn } from "~/game-runtime/read/fn/isBoardRuntimeItemFn";
import { isGridRuntimeItemFn } from "~/game-runtime/read/fn/isGridRuntimeItemFn";
import { GameConfigSchema } from "~/game-config/GameConfigSchema";
import type { StateSchema } from "~/game-persistence/schema/StateSchema";

const baseItem = ({ id }: { id: string }) => ({
	uid: id,
	id,
	title: id,
	description: id,
	asset: {
		default: [
			`asset:${id}`,
		],
	},
	scope: "any" as const,
	maxStackSize: 1,
});

const producerItem = ({
	id,
	merge,
	selectorItemId = "material",
}: {
	id: string;
	merge?: [
		MergeSchema.Type,
		...MergeSchema.Type[],
	];
	selectorItemId?: string;
}) => ({
	...baseItem({
		id,
	}),
	type: "producer" as const,
	maxQueueSize: 2,
	merge,
	lines: [
		{
			id: `line:${id}`,
			title: `line:${id}`,
			description: `line:${id}`,
			runtimeMs: 1_000,
			input: [
				{
					type: "materials" as const,
					selector: {
						type: "item" as const,
						itemId: selectorItemId,
					},
					quantity: {
						min: 1,
						max: 1,
					},
					capacity: 3,
					mode: "reserve" as const,
				},
			],
			rules: [],
		},
	],
});

const createLifecycleConfig = ({
	action = "consume",
	effect = "keep",
	sourceProducer = false,
	targetProducer = false,
	resultCharges,
	sourceInputItemId = "material",
	targetCharges,
	ownerInputItemId = "material",
}: {
	action?: "consume" | "use";
	effect?: "keep" | "remove" | "replace";
	resultCharges?: number;
	sourceInputItemId?: string;
	sourceProducer?: boolean;
	targetCharges?: number;
	targetProducer?: boolean;
	ownerInputItemId?: string;
} = {}) => {
	const targetSelector = {
		type: "item" as const,
		itemId: "target",
	};
	const merge: MergeSchema.Type =
		effect === "replace"
			? {
					target: targetSelector,
					action,
					effect,
					result: "result",
				}
			: {
					target: targetSelector,
					action,
					effect,
				};
	const source = sourceProducer
		? producerItem({
				id: "source",
				merge: [
					merge,
				],
				selectorItemId: sourceInputItemId,
			})
		: {
				...baseItem({
					id: "source",
				}),
				type: "simple" as const,
				merge: [
					merge,
				],
			};
	const target = targetProducer
		? producerItem({
				id: "target",
			})
		: {
				...baseItem({
					id: "target",
				}),
				charges:
					targetCharges === undefined
						? undefined
						: {
								amount: targetCharges,
							},
				type: "simple" as const,
			};

	return GameConfigSchema.parse({
		resources: {
			hero: "hero",
		},
		meta: {
			id: "game:merge-lifecycle",
			title: "Merge lifecycle",
			board: {
				width: 6,
				height: 2,
			},
			inventory: {
				width: 3,
				height: 1,
			},
		},
		start: {
			currentSpace: 0,
		},
		items: {
			source,
			target,
			child: producerItem({
				id: "child",
			}),
			result: {
				...baseItem({
					id: "result",
				}),
				charges:
					resultCharges === undefined
						? undefined
						: {
								amount: resultCharges,
							},
				type: "simple",
			},
			material: {
				...baseItem({
					id: "material",
				}),
				charges: {
					amount: 2,
				},
				type: "simple",
			},
			owner: producerItem({
				id: "owner",
				selectorItemId: ownerInputItemId,
			}),
		},
	});
};

const boardItem = (id: "source" | "target" | "owner", x: number) => ({
	id: `runtime:${id}`,
	itemId: id,
	location: {
		scope: "board" as const,
		space: 0,
		position: {
			x,
			y: 0,
		},
	},
	quantity: 1,
});

const attemptMergeFx = () =>
	Effect.gen(function* () {
		const before = yield* readRuntimeFx();
		const source = before.items.find((item) => item.id === "runtime:source");
		const target = before.items.find((item) => item.id === "runtime:target");
		if (source === undefined || target === undefined) {
			return yield* Effect.die(new Error("Expected merge participants."));
		}
		const attempt = yield* Effect.result(
			mergeItemsFx({
				sourceItemId: source.id,
				sourceRevision: source.revision,
				targetItemId: target.id,
				targetRevision: target.revision,
			}),
		);
		return {
			after: yield* readRuntimeFx(),
			attempt,
			before,
		};
	});

describe("mergeItemsFx participant lifecycle", () => {
	for (const scope of [
		"input",
		"job",
		"reserved",
	] as const) {
		for (const participant of [
			"source",
			"target",
		] as const) {
			it(`rejects a ${scope}-scoped ${participant}`, () => {
				const participantLocation =
					scope === "input"
						? {
								scope,
								ownerItemId: "runtime:owner",
								lineId: "line:owner",
								inputIndex: 0,
							}
						: {
								scope,
								jobId: "job:owner",
							};
				const state = {
					cheats: {
						enabled: false,
						everEnabled: false,
						instantGameplay: false,
					},
					currentSpace: 0,
					items: [
						participant === "source"
							? {
									...boardItem("source", 0),
									location: participantLocation,
								}
							: boardItem("source", 0),
						participant === "target"
							? {
									...boardItem("target", 1),
									location: participantLocation,
								}
							: boardItem("target", 1),
						boardItem("owner", 2),
					],
					jobQueue: [],
					jobs:
						scope === "job" || scope === "reserved"
							? [
									{
										id: "job:owner",
										ownerItemId: "runtime:owner",
										lineId: "line:owner",
										durationMs: 1_000,
										remainingMs: 1_000,
									},
								]
							: [],
				} satisfies StateSchema.Type;
				const result = Effect.runSync(
					attemptMergeFx().pipe(
						useGameFx({
							config: createLifecycleConfig({
								ownerInputItemId: participant,
							}),
							state,
						}),
					),
				);

				expect(Result.isFailure(result.attempt)).toBe(true);
				if (Result.isFailure(result.attempt)) {
					expect(result.attempt.failure._tag).toBe(
						participant === "source" ? "ItemNotOnGridError" : "ItemNotOnBoardError",
					);
				}
				expect(result.after).toEqual(result.before);
			});
		}
	}

	it("rejects active or queued work on a consumed source", () => {
		const config = createLifecycleConfig({
			sourceProducer: true,
		});
		for (const mode of [
			"active",
			"queued",
		] as const) {
			const state = {
				cheats: {
					enabled: false,
					everEnabled: false,
					instantGameplay: false,
				},
				currentSpace: 0,
				items: [
					boardItem("source", 0),
					boardItem("target", 1),
				],
				jobs:
					mode === "active"
						? [
								{
									id: "job:source",
									ownerItemId: "runtime:source",
									lineId: "line:source",
									durationMs: 1_000,
									remainingMs: 1_000,
								},
							]
						: [],
				jobQueue:
					mode === "queued"
						? [
								{
									id: "request:source",
									ownerItemId: "runtime:source",
									lineId: "line:source",
								},
							]
						: [],
			} satisfies StateSchema.Type;
			const result = Effect.runSync(
				attemptMergeFx().pipe(
					useGameFx({
						config,
						state,
					}),
				),
			);
			expect(Result.isFailure(result.attempt)).toBe(true);
			if (Result.isFailure(result.attempt)) {
				expect(result.attempt.failure).toMatchObject({
					_tag: "JobOwnerBusyError",
					ownerItemId: "runtime:source",
				});
			}
			expect(result.after).toEqual(result.before);
		}
	});

	it("preserves runtime when a consumed source's buffered child owns queued work", () => {
		const config = createLifecycleConfig({
			sourceInputItemId: "child",
			sourceProducer: true,
		});
		const state = {
			cheats: {
				enabled: false,
				everEnabled: false,
				instantGameplay: false,
			},
			currentSpace: 0,
			items: [
				boardItem("source", 0),
				boardItem("target", 1),
				{
					id: "runtime:unrelated",
					itemId: "child",
					location: {
						scope: "board",
						space: 0,
						position: {
							x: 2,
							y: 0,
						},
					},
					quantity: 1,
				},
				{
					id: "runtime:child",
					itemId: "child",
					location: {
						inputIndex: 0,
						lineId: "line:source",
						ownerItemId: "runtime:source",
						scope: "input",
					},
					quantity: 1,
				},
			],
			jobQueue: [],
			jobs: [],
		} satisfies StateSchema.Type;
		const result = Effect.runSync(
			Effect.gen(function* () {
				const canonical = yield* readRuntimeFx();
				const runtimeSource = canonical.items.find((item) => item.id === "runtime:source");
				const runtimeTarget = canonical.items.find((item) => item.id === "runtime:target");
				if (runtimeSource === undefined || runtimeTarget === undefined) {
					return yield* Effect.die(new Error("Expected merge participants."));
				}
				const source = Option.getOrUndefined(isGridRuntimeItemFn(runtimeSource));
				const target = Option.getOrUndefined(isBoardRuntimeItemFn(runtimeTarget));
				const rule = source?.item.merge?.[0];
				if (source === undefined || target === undefined || rule === undefined) {
					return yield* Effect.die(new Error("Expected Board merge participants."));
				}
				const runtime = {
					...canonical,
					jobQueue: [
						{
							id: "request:unrelated",
							lineId: "line:child",
							ownerItemId: "runtime:unrelated",
						},
						{
							id: "request:child",
							lineId: "line:child",
							ownerItemId: "runtime:child",
						},
					],
				};
				const before = structuredClone(runtime);
				const attempt = yield* Effect.result(
					applyMergeRuntimeFx({
						rule,
						runtime,
						source,
						target,
					}),
				);
				return {
					attempt,
					before,
					runtime,
				};
			}).pipe(
				useGameFx({
					config,
					state,
				}),
			),
		);

		expect(Result.isFailure(result.attempt)).toBe(true);
		if (Result.isFailure(result.attempt)) {
			expect(result.attempt.failure).toMatchObject({
				_tag: "JobOwnerBusyError",
				ownerItemId: "runtime:source",
				requestIds: [
					"request:child",
				],
			});
		}
		expect(result.runtime).toEqual(result.before);
	});

	it("allows keep on a busy target but rejects remove or replace", () => {
		for (const effect of [
			"keep",
			"remove",
			"replace",
		] as const) {
			const config = createLifecycleConfig({
				effect,
				targetProducer: true,
			});
			const state = {
				cheats: {
					enabled: false,
					everEnabled: false,
					instantGameplay: false,
				},
				currentSpace: 0,
				items: [
					boardItem("source", 0),
					boardItem("target", 1),
				],
				jobQueue: [],
				jobs: [
					{
						id: "job:target",
						ownerItemId: "runtime:target",
						lineId: "line:target",
						durationMs: 1_000,
						remainingMs: 1_000,
					},
				],
			} satisfies StateSchema.Type;
			const result = Effect.runSync(
				attemptMergeFx().pipe(
					useGameFx({
						config,
						state,
					}),
				),
			);

			if (effect === "keep") {
				expect(Result.isSuccess(result.attempt)).toBe(true);
				expect(result.after.jobs).toEqual(result.before.jobs);
				expect(
					result.after.items.find((item) => item.id === "runtime:target")?.item.id,
				).toBe("target");
			} else {
				expect(Result.isFailure(result.attempt)).toBe(true);
				if (Result.isFailure(result.attempt)) {
					expect(result.attempt.failure._tag).toBe("JobOwnerBusyError");
				}
				expect(result.after).toEqual(result.before);
			}
		}
	});

	it("rejects a stateful use source but destructively consumes the same idle owned subtree", () => {
		for (const action of [
			"use",
			"consume",
		] as const) {
			const config = createLifecycleConfig({
				action,
				sourceProducer: true,
			});
			const state = {
				cheats: {
					enabled: false,
					everEnabled: false,
					instantGameplay: false,
				},
				currentSpace: 0,
				items: [
					boardItem("source", 0),
					boardItem("target", 1),
					{
						id: "runtime:source:material",
						itemId: "material",
						location: {
							scope: "input",
							ownerItemId: "runtime:source",
							lineId: "line:source",
							inputIndex: 0,
						},
						quantity: 1,
					},
				],
				jobQueue: [],
				jobs: [],
			} satisfies StateSchema.Type;
			const result = Effect.runSync(
				attemptMergeFx().pipe(
					useGameFx({
						config,
						state,
					}),
				),
			);

			if (action === "use") {
				expect(Result.isFailure(result.attempt)).toBe(true);
				if (Result.isFailure(result.attempt)) {
					expect(result.attempt.failure._tag).toBe("ItemStatefulError");
				}
				expect(result.after).toEqual(result.before);
			} else {
				expect(Result.isSuccess(result.attempt)).toBe(true);
				expect(result.after.items.some((item) => item.id === "runtime:source")).toBe(false);
				expect(
					result.after.items.some((item) => item.id === "runtime:source:material"),
				).toBe(false);
			}
		}
	});

	it("initializes replacement state through the canonical runtime-item constructor", () => {
		const config = createLifecycleConfig({
			effect: "replace",
			resultCharges: 2,
		});
		const state = {
			cheats: {
				enabled: false,
				everEnabled: false,
				instantGameplay: false,
			},
			currentSpace: 0,
			items: [
				boardItem("source", 0),
				boardItem("target", 1),
			],
			jobQueue: [],
			jobs: [],
		} satisfies StateSchema.Type;
		const result = Effect.runSync(
			attemptMergeFx().pipe(
				useGameFx({
					config,
					state,
				}),
			),
		);

		expect(Result.isSuccess(result.attempt)).toBe(true);
		const beforeTarget = result.before.items.find((item) => item.id === "runtime:target");
		const replaced = result.after.items.find((item) => item.id === "runtime:target");
		expect(replaced).toMatchObject({
			id: "runtime:target",
			item: {
				id: "result",
				charges: {
					amount: 2,
				},
			},
			location: beforeTarget?.location,
			quantity: 1,
			remainingCharges: undefined,
		});
		expect(replaced?.revision).not.toBe(beforeTarget?.revision);
	});

	it("preserves spent charges through a compatible replacement", () => {
		const config = createLifecycleConfig({
			effect: "replace",
			resultCharges: 36,
			targetCharges: 18,
		});
		const state = {
			cheats: {
				enabled: false,
				everEnabled: false,
				instantGameplay: false,
			},
			currentSpace: 0,
			items: [
				boardItem("source", 0),
				{
					...boardItem("target", 1),
					remainingCharges: 5,
				},
			],
			jobQueue: [],
			jobs: [],
		} satisfies StateSchema.Type;
		const result = Effect.runSync(
			attemptMergeFx().pipe(
				useGameFx({
					config,
					state,
				}),
			),
		);

		expect(Result.isSuccess(result.attempt)).toBe(true);
		expect(result.after.items.find((item) => item.id === "runtime:target")).toMatchObject({
			item: {
				id: "result",
				charges: {
					amount: 36,
				},
			},
			remainingCharges: 23,
		});
	});

	it("rejects a charged replacement when the result cannot carry its wear", () => {
		const config = createLifecycleConfig({
			effect: "replace",
			targetCharges: 18,
		});
		const state = {
			cheats: {
				enabled: false,
				everEnabled: false,
				instantGameplay: false,
			},
			currentSpace: 0,
			items: [
				boardItem("source", 0),
				{
					...boardItem("target", 1),
					remainingCharges: 5,
				},
			],
			jobQueue: [],
			jobs: [],
		} satisfies StateSchema.Type;
		const result = Effect.runSync(
			attemptMergeFx().pipe(
				useGameFx({
					config,
					state,
				}),
			),
		);

		expect(Result.isFailure(result.attempt)).toBe(true);
		if (Result.isFailure(result.attempt)) {
			expect(result.attempt.failure._tag).toBe("ItemStatefulError");
		}
		expect(result.after).toEqual(result.before);
	});

	it("rejects replacing stateful targets but remove releases buffered inputs", () => {
		for (const effect of [
			"replace",
			"remove",
		] as const) {
			const config = createLifecycleConfig({
				effect,
				targetProducer: true,
			});
			const state = {
				cheats: {
					enabled: false,
					everEnabled: false,
					instantGameplay: false,
				},
				currentSpace: 0,
				items: [
					boardItem("source", 0),
					boardItem("target", 1),
					{
						id: "runtime:target:material",
						itemId: "material",
						location: {
							scope: "input",
							ownerItemId: "runtime:target",
							lineId: "line:target",
							inputIndex: 0,
						},
						quantity: 1,
						remainingCharges: 1,
					},
				],
				jobQueue: [],
				jobs: [],
			} satisfies StateSchema.Type;
			const result = Effect.runSync(
				attemptMergeFx().pipe(
					useGameFx({
						config,
						state,
					}),
				),
			);

			if (effect === "replace") {
				expect(Result.isFailure(result.attempt)).toBe(true);
				if (Result.isFailure(result.attempt)) {
					expect(result.attempt.failure._tag).toBe("ItemStatefulError");
				}
				expect(result.after).toEqual(result.before);
			} else {
				expect(Result.isSuccess(result.attempt)).toBe(true);
				expect(result.after.items.some((item) => item.id === "runtime:target")).toBe(false);
				const released = result.after.items.find(
					(item) => item.id === "runtime:target:material",
				);
				expect(released).toMatchObject({
					remainingCharges: 1,
					location: {
						scope: "board",
					},
				});
			}
		}
	});
});
