import { Effect, type Layer } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/game/useGameFx";
import type { GameLayerFx } from "~test/support/game/GameLayerFx";
import { storeInputMaterialFx } from "~/production-input/fx/storeInputMaterialFx";
import { isItemPureFn } from "~/game-runtime/fn/isItemPureFn";
import { setDefaultLineFx } from "~/production-line/fx/setDefaultLineFx";
import { readDropItemPreviewFx } from "~/item-interaction/fx/readDropItemPreviewFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { DropItemResultKind } from "~/item-interaction/type/DropItemResult";
import { dropItemFx } from "~/item-interaction/fx/dropItemFx";
import { spawnItemFx } from "~test/support/runtime/spawnItemFx";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import {
	inputRuntimeTestConfig,
	sourceLocation,
	workshopLocation,
} from "~test/production-input/support/inputRuntimeTestConfig";

const lineId = "line:workshop:build";

const mergeBeforeInputConfig = GameConfigSchema.parse({
	...inputRuntimeTestConfig,
	meta: {
		...inputRuntimeTestConfig.meta,
		id: "game:drop-input-merge-precedence",
	},
	items: {
		...inputRuntimeTestConfig.items,
		water: {
			...inputRuntimeTestConfig.items.water,
			merge: [
				{
					target: {
						type: "item",
						itemId: "workshop",
					},
					action: "consume",
					effect: "keep",
				},
			],
		},
	},
});

const workshopDefinition = inputRuntimeTestConfig.items.workshop;
if (workshopDefinition?.type !== "producer") {
	throw new Error("Expected workshop producer definition.");
}

const authoredDefaultConfig = GameConfigSchema.parse({
	...inputRuntimeTestConfig,
	meta: {
		...inputRuntimeTestConfig.meta,
		id: "game:drop-input-authored-default",
	},
	items: {
		...inputRuntimeTestConfig.items,
		workshop: {
			...workshopDefinition,
			lines: workshopDefinition.lines.map((line) => ({
				...line,
				default: true,
			})),
		},
	},
});

const authoredDefaultBlockedConfig = GameConfigSchema.parse({
	...authoredDefaultConfig,
	meta: {
		...authoredDefaultConfig.meta,
		id: "game:drop-input-authored-default-blocked",
		board: {
			width: 1,
			height: 1,
		},
		inventory: {
			width: 2,
			height: 1,
		},
	},
});

const run = <A, E>(
	effect: Effect.Effect<A, E, Layer.Success<ReturnType<typeof GameLayerFx>>>,
	config: GameConfigSchema.Type = inputRuntimeTestConfig,
) =>
	Effect.runSync(
		effect.pipe(
			useGameFx({
				config,
			}),
		),
	);

const setupFx = ({ quantity }: { readonly quantity: number }) =>
	Effect.gen(function* () {
		yield* spawnItemFx({
			id: "runtime:workshop",
			itemId: "workshop",
			location: workshopLocation,
			quantity: 1,
		});
		yield* spawnItemFx({
			id: "runtime:water",
			itemId: "water",
			location: sourceLocation(1),
			quantity,
		});
		yield* setDefaultLineFx({
			ownerItemId: "runtime:workshop",
			lineId,
		});
		const runtime = yield* readRuntimeFx();
		const owner = runtime.items.find((item) => item.id === "runtime:workshop");
		const source = runtime.items.find((item) => item.id === "runtime:water");
		if (owner === undefined || source === undefined)
			throw new Error("Missing drop setup items.");
		if (owner.location.scope === "input" || source.location.scope === "input") {
			throw new Error("Expected visible grid setup items.");
		}
		return {
			owner,
			source,
		};
	});

const targetFor = ({ revision }: { readonly revision: string }) => ({
	kind: "slot" as const,
	location: workshopLocation,
	occupant: {
		itemId: "runtime:workshop",
		revision,
	},
});

const previewFx = ({
	ownerRevision,
	sourceRevision,
}: {
	readonly ownerRevision: string;
	readonly sourceRevision: string;
}) =>
	readDropItemPreviewFx({
		sourceItemId: "runtime:water",
		sourceRevision,
		sourceLocation: sourceLocation(1),
		target: targetFor({
			revision: ownerRevision,
		}),
	});

const dropFx = ({
	ownerRevision,
	sourceRevision,
}: {
	readonly ownerRevision: string;
	readonly sourceRevision: string;
}) =>
	dropItemFx({
		sourceItemId: "runtime:water",
		sourceRevision,
		sourceLocation: sourceLocation(1),
		target: targetFor({
			revision: ownerRevision,
		}),
	});

describe("dropItemFx default-line input storage", () => {
	it("uses an authored fallback without state until the drop atomically isolates one stacked owner", () => {
		const result = run(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:workshop",
					itemId: "workshop",
					location: workshopLocation,
					quantity: 3,
				});
				const source = yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: sourceLocation(1),
					quantity: 1,
				});
				const before = yield* readRuntimeFx();
				const beforeOwner = before.items.find((item) => item.id === owner.id);
				if (beforeOwner === undefined) throw new Error("Missing authored-default owner.");
				const pureBefore = isItemPureFn({
					item: beforeOwner,
					runtime: before,
				});
				const preview = yield* previewFx({
					ownerRevision: owner.revision,
					sourceRevision: source.revision,
				});
				const outcome = yield* dropFx({
					ownerRevision: owner.revision,
					sourceRevision: source.revision,
				});
				const runtime = yield* readRuntimeFx();
				const isolated = runtime.items.find((item) => item.id === owner.id);
				const remainder = runtime.items.find(
					(item) => item.item.id === "workshop" && item.id !== owner.id,
				);
				if (isolated === undefined || remainder === undefined) {
					throw new Error("Expected isolated owner and pure remainder.");
				}
				return {
					isolated,
					outcome,
					preview,
					pureBefore,
					remainder,
					remainderPure: isItemPureFn({
						item: remainder,
						runtime,
					}),
					runtime,
				};
			}),
			authoredDefaultConfig,
		);

		expect(result.pureBefore).toBe(true);
		expect(result.preview).toEqual({
			kind: DropItemResultKind.StoreInput,
			lineId,
			inputIndex: 0,
			quantity: 1,
		});
		expect(result.outcome.kind).toBe(DropItemResultKind.StoreInput);
		expect(result.runtime.defaultLineByOwnerItemId).toEqual({});
		expect(result.isolated).toMatchObject({
			id: "runtime:workshop",
			quantity: 1,
		});
		expect(result.remainder).toMatchObject({
			quantity: 2,
		});
		expect(result.remainderPure).toBe(true);
	});

	it("rolls back an authored-default drop when the isolated remainder cannot be placed", () => {
		const inventorySourceLocation = {
			scope: "inventory" as const,
			position: {
				x: 0,
				y: 0,
			},
		};
		const result = run(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:workshop",
					itemId: "workshop",
					location: workshopLocation,
					quantity: 2,
				});
				const source = yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: inventorySourceLocation,
					quantity: 7,
				});
				yield* spawnItemFx({
					id: "runtime:blocker",
					itemId: "stone",
					location: {
						scope: "inventory",
						position: {
							x: 1,
							y: 0,
						},
					},
					quantity: 1,
				});
				const target = targetFor({
					revision: owner.revision,
				});
				const preview = yield* readDropItemPreviewFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation: inventorySourceLocation,
					target,
				});
				const before = yield* readRuntimeFx();
				const dropped = yield* Effect.result(
					dropItemFx({
						sourceItemId: source.id,
						sourceRevision: source.revision,
						sourceLocation: inventorySourceLocation,
						target,
					}),
				);
				return {
					after: yield* readRuntimeFx(),
					before,
					dropped,
					preview,
				};
			}),
			authoredDefaultBlockedConfig,
		);

		expect(result.preview.kind).toBe(DropItemResultKind.StoreInput);
		expect(result.dropped._tag).toBe("Success");
		if (result.dropped._tag === "Success") {
			expect(result.dropped.success).toEqual({
				kind: DropItemResultKind.Reject,
				reason: "blocked",
				itemId: "runtime:water",
				targetItemId: "runtime:workshop",
			});
		}
		expect(result.after).toEqual(result.before);
	});

	it("previews and commits a full visible source store before swap", () => {
		const result = run(
			Effect.gen(function* () {
				const { owner, source } = yield* setupFx({
					quantity: 2,
				});
				const preview = yield* previewFx({
					ownerRevision: owner.revision,
					sourceRevision: source.revision,
				});
				const outcome = yield* dropFx({
					ownerRevision: owner.revision,
					sourceRevision: source.revision,
				});
				return {
					outcome,
					preview,
					runtime: yield* readRuntimeFx(),
				};
			}),
		);

		expect(result.preview).toEqual({
			kind: DropItemResultKind.StoreInput,
			lineId,
			inputIndex: 0,
			quantity: 2,
		});
		expect(result.outcome).toMatchObject({
			kind: DropItemResultKind.StoreInput,
			storedQuantity: 2,
			lineId,
			inputIndex: 0,
			source: {
				itemId: "runtime:water",
				canonicalItemId: "water",
				previousLocation: sourceLocation(1),
				previousQuantity: 2,
				current: null,
			},
			owner: {
				itemId: "runtime:workshop",
				location: workshopLocation,
			},
		});
		expect(result.runtime.items.find((item) => item.id === "runtime:water")?.location).toEqual({
			scope: "input",
			ownerItemId: "runtime:workshop",
			lineId,
			inputIndex: 0,
		});
	});

	it("reports one partial store and keeps the same visible source identity", () => {
		const result = run(
			Effect.gen(function* () {
				const { owner, source } = yield* setupFx({
					quantity: 7,
				});
				const outcome = yield* dropFx({
					ownerRevision: owner.revision,
					sourceRevision: source.revision,
				});
				return {
					outcome,
					runtime: yield* readRuntimeFx(),
				};
			}),
		);

		expect(result.outcome).toMatchObject({
			kind: DropItemResultKind.StoreInput,
			storedQuantity: 5,
			source: {
				itemId: "runtime:water",
				previousQuantity: 7,
				current: {
					itemId: "runtime:water",
					canonicalItemId: "water",
					location: sourceLocation(1),
					quantity: 2,
				},
			},
		});
		const visibleSource = result.runtime.items.find((item) => item.id === "runtime:water");
		expect(visibleSource?.quantity).toBe(2);
		expect(visibleSource?.location).toEqual(sourceLocation(1));
		expect(
			result.runtime.items
				.filter((item) => item.location.scope === "input")
				.reduce((total, item) => total + item.quantity, 0),
		).toBe(5);
	});

	it("admits only a valid exact input request before a compatible authored merge", () => {
		const result = run(
			Effect.gen(function* () {
				const { owner, source } = yield* setupFx({
					quantity: 7,
				});
				const exactTarget = targetFor({
					revision: owner.revision,
				});
				const command = {
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation: sourceLocation(1),
				};
				const invalidTarget = {
					...exactTarget,
					inputStore: {
						lineId,
						inputIndex: 1,
						quantity: 1,
					},
				};
				const before = yield* readRuntimeFx();
				const invalidPreview = yield* readDropItemPreviewFx({
					...command,
					target: invalidTarget,
				});
				const invalidOutcome = yield* dropItemFx({
					...command,
					target: invalidTarget,
				});
				const afterInvalid = yield* readRuntimeFx();
				const validTarget = {
					...exactTarget,
					inputStore: {
						lineId,
						inputIndex: 0,
						quantity: 3,
					},
				};
				const preview = yield* readDropItemPreviewFx({
					...command,
					target: validTarget,
				});
				const outcome = yield* dropItemFx({
					...command,
					target: validTarget,
				});
				return {
					afterInvalid,
					before,
					invalidOutcome,
					invalidPreview,
					outcome,
					preview,
					runtime: yield* readRuntimeFx(),
				};
			}),
			mergeBeforeInputConfig,
		);

		expect(result.invalidPreview).toEqual({
			kind: DropItemResultKind.Reject,
			reason: "blocked",
		});
		expect(result.invalidOutcome).toEqual({
			kind: DropItemResultKind.Reject,
			reason: "blocked",
			itemId: "runtime:water",
			targetItemId: "runtime:workshop",
		});
		expect(result.afterInvalid).toEqual(result.before);
		expect(result.preview).toEqual({
			kind: DropItemResultKind.StoreInput,
			lineId,
			inputIndex: 0,
			quantity: 3,
		});
		expect(result.outcome).toMatchObject({
			kind: DropItemResultKind.StoreInput,
			storedQuantity: 3,
			source: {
				previousQuantity: 7,
				current: {
					location: sourceLocation(1),
					quantity: 4,
				},
			},
		});
		expect(
			result.runtime.items
				.filter((item) => item.location.scope === "input")
				.reduce((total, item) => total + item.quantity, 0),
		).toBe(3);
	});

	it("preserves ordinary swap when the target has no selected default line", () => {
		const result = run(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:workshop",
					itemId: "workshop",
					location: workshopLocation,
					quantity: 1,
				});
				const source = yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: sourceLocation(1),
					quantity: 1,
				});
				const preview = yield* previewFx({
					ownerRevision: owner.revision,
					sourceRevision: source.revision,
				});
				const outcome = yield* dropFx({
					ownerRevision: owner.revision,
					sourceRevision: source.revision,
				});
				return {
					outcome,
					preview,
				};
			}),
		);

		expect(result.preview).toEqual({
			kind: DropItemResultKind.Swap,
		});
		expect(result.outcome.kind).toBe(DropItemResultKind.Swap);
	});

	it("falls back to swap when the selected input has no remaining capacity", () => {
		const result = run(
			Effect.gen(function* () {
				const { owner, source } = yield* setupFx({
					quantity: 5,
				});
				yield* storeInputMaterialFx({
					ownerItemId: owner.id,
					lineId,
					inputIndex: 0,
					sourceItemId: "runtime:water",
					sourceItemRevision: source.revision,
					quantity: 5,
				});
				const extra = yield* spawnItemFx({
					id: "runtime:water-extra",
					itemId: "water",
					location: sourceLocation(1),
					quantity: 1,
				});
				const runtime = yield* readRuntimeFx();
				const currentOwner = runtime.items.find((item) => item.id === owner.id);
				if (currentOwner === undefined) throw new Error("Missing current owner.");
				return yield* readDropItemPreviewFx({
					sourceItemId: extra.id,
					sourceRevision: extra.revision,
					sourceLocation: sourceLocation(1),
					target: targetFor({
						revision: currentOwner.revision,
					}),
				});
			}),
		);

		expect(result).toEqual({
			kind: DropItemResultKind.Swap,
		});
	});

	it("keeps authored merge precedence over default-line input storage", () => {
		const result = run(
			Effect.gen(function* () {
				const { owner, source } = yield* setupFx({
					quantity: 1,
				});
				return yield* previewFx({
					ownerRevision: owner.revision,
					sourceRevision: source.revision,
				});
			}),
			mergeBeforeInputConfig,
		);

		expect(result).toEqual({
			kind: DropItemResultKind.Merge,
		});
	});
});
