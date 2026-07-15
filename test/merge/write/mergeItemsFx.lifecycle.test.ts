import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/v1/game/fx/useGameFx";
import type { MergeSchema } from "~/v1/merge/schema/MergeSchema";
import { mergeItemsFx } from "~/v1/merge/write/mergeItemsFx";
import { readRuntimeFx } from "~/v1/runtime/read/readRuntimeFx";
import { GameConfigSchema } from "~/v1/schema/GameConfigSchema";
import type { StateSchema } from "~/v1/state/schema/StateSchema";

const baseItem = ({ id, tags = [] }: { id: string; tags?: string[] }) => ({
	id,
	title: id,
	description: id,
	asset: {
		source: [
			`asset:${id}`,
		],
	},
	tags,
	categoryId: "resource",
	scope: "any" as const,
	maxStackSize: 1,
});

const producerItem = ({
	id,
	merge,
	selectorTag = "material",
}: {
	id: string;
	merge?: [
		MergeSchema.Type,
		...MergeSchema.Type[],
	];
	selectorTag?: string;
}) => ({
	...baseItem({
		id,
		tags: [
			"participant",
		],
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
						type: "tag" as const,
						tag: selectorTag,
					},
					quantity: {
						type: "value" as const,
						value: 1,
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
}: {
	action?: "consume" | "use";
	effect?: "keep" | "remove" | "replace";
	sourceProducer?: boolean;
	targetProducer?: boolean;
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
			})
		: {
				...baseItem({
					id: "source",
					tags: [
						"participant",
					],
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
					tags: [
						"participant",
					],
				}),
				type: "simple" as const,
			};

	return GameConfigSchema.parse({
		version: "1.0",
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
		start: {},
		categories: {},
		items: {
			source,
			target,
			result: {
				...baseItem({
					id: "result",
				}),
				type: "simple",
			},
			material: {
				...baseItem({
					id: "material",
					tags: [
						"material",
						"participant",
					],
				}),
				type: "simple",
			},
			owner: producerItem({
				id: "owner",
				selectorTag: "participant",
			}),
		},
	});
};

const boardItem = (id: "source" | "target" | "owner", x: number) => ({
	id: `runtime:${id}`,
	itemId: id,
	location: {
		scope: "board" as const,
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
			return yield* Effect.dieMessage("Expected merge participants.");
		}
		const attempt = yield* Effect.either(
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
							config: createLifecycleConfig(),
							state,
						}),
					),
				);

				expect(Either.isLeft(result.attempt)).toBe(true);
				if (Either.isLeft(result.attempt)) {
					expect(result.attempt.left._tag).toBe(
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
			expect(Either.isLeft(result.attempt)).toBe(true);
			if (Either.isLeft(result.attempt)) {
				expect(result.attempt.left).toMatchObject({
					_tag: "JobOwnerBusyError",
					ownerItemId: "runtime:source",
				});
			}
			expect(result.after).toEqual(result.before);
		}
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
				items: [
					boardItem("source", 0),
					boardItem("target", 1),
				],
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
				expect(Either.isRight(result.attempt)).toBe(true);
				expect(result.after.jobs).toEqual(result.before.jobs);
				expect(
					result.after.items.find((item) => item.id === "runtime:target")?.item.id,
				).toBe("target");
			} else {
				expect(Either.isLeft(result.attempt)).toBe(true);
				if (Either.isLeft(result.attempt)) {
					expect(result.attempt.left._tag).toBe("JobOwnerBusyError");
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
				expect(Either.isLeft(result.attempt)).toBe(true);
				if (Either.isLeft(result.attempt)) {
					expect(result.attempt.left._tag).toBe("ItemStatefulError");
				}
				expect(result.after).toEqual(result.before);
			} else {
				expect(Either.isRight(result.attempt)).toBe(true);
				expect(result.after.items.some((item) => item.id === "runtime:source")).toBe(false);
				expect(
					result.after.items.some((item) => item.id === "runtime:source:material"),
				).toBe(false);
			}
		}
	});

	it("rejects replacing stateful or stacked targets but remove releases buffered inputs", () => {
		for (const effect of [
			"replace",
			"remove",
		] as const) {
			const config = createLifecycleConfig({
				effect,
				targetProducer: true,
			});
			const state = {
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
					},
				],
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
				expect(Either.isLeft(result.attempt)).toBe(true);
				if (Either.isLeft(result.attempt)) {
					expect(result.attempt.left._tag).toBe("ItemStatefulError");
				}
				expect(result.after).toEqual(result.before);
			} else {
				expect(Either.isRight(result.attempt)).toBe(true);
				expect(result.after.items.some((item) => item.id === "runtime:target")).toBe(false);
				const released = result.after.items.find((item) => item.item.id === "material");
				expect(released?.location.scope).toBe("board");
				expect(released?.id).not.toBe("runtime:target:material");
			}
		}

		const stackedConfig = createLifecycleConfig({
			effect: "replace",
		});
		const stackedState = {
			items: [
				boardItem("source", 0),
				{
					...boardItem("target", 1),
					quantity: 2,
				},
			],
			jobs: [],
		} satisfies StateSchema.Type;
		const stacked = Effect.runSync(
			attemptMergeFx().pipe(
				useGameFx({
					config: GameConfigSchema.parse({
						...stackedConfig,
						items: {
							...stackedConfig.items,
							target: {
								...stackedConfig.items.target,
								maxStackSize: 2,
							},
						},
					}),
					state: stackedState,
				}),
			),
		);
		expect(Either.isLeft(stacked.attempt)).toBe(true);
		if (Either.isLeft(stacked.attempt)) {
			expect(stacked.attempt.left._tag).toBe("MergeTargetStackedError");
		}
		expect(stacked.after).toEqual(stacked.before);
	});
});
