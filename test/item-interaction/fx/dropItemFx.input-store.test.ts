import { Effect, type Layer } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import type { GameLayerFx } from "~test/support/GameLayerFx";
import { storeInputMaterialFx } from "~/production-input/fx/storeInputMaterialFx";
import { setLineSelectionFx } from "~/production-line/fx/setLineSelectionFx";
import { readDropItemPreviewFx } from "~/item-interaction/fx/readDropItemPreviewFx";
import { readRuntimeFx } from "~/game-runtime/fx/readRuntimeFx";
import { DropItemResultKind } from "~/item-interaction/type/DropItemResult";
import { dropItemFx } from "~/item-interaction/fx/dropItemFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
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
if (workshopDefinition === undefined) {
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

const setupFx = () =>
	Effect.gen(function* () {
		yield* spawnItemFx({
			id: "runtime:workshop",
			itemId: "workshop",
			location: workshopLocation,
		});
		yield* spawnItemFx({
			id: "runtime:water",
			itemId: "water",
			location: sourceLocation(1),
		});
		yield* setLineSelectionFx({
			selection: "default",
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
	it("uses an authored fallback without persisting a line selection or replacing the owner", () => {
		const result = run(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:workshop",
					itemId: "workshop",
					location: workshopLocation,
				});
				const source = yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: sourceLocation(1),
				});
				const before = yield* readRuntimeFx();
				const beforeOwner = before.items.find((item) => item.id === owner.id);
				if (beforeOwner === undefined) throw new Error("Missing authored-default owner.");
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
				if (isolated === undefined) throw new Error("Missing owner");
				return {
					isolated,
					outcome,
					preview,
					runtime,
				};
			}),
			authoredDefaultConfig,
		);

		expect(result.preview).toEqual({
			kind: DropItemResultKind.StoreInput,
			lineId,
			inputIndex: 0,
		});
		expect(result.outcome.kind).toBe(DropItemResultKind.StoreInput);
		expect(result.runtime.defaultLineByOwnerItemId).toEqual({});
		expect(result.isolated).toMatchObject({
			id: "runtime:workshop",
		});
		expect(result.runtime.items.filter((item) => item.item.id === "workshop")).toHaveLength(1);
	});

	it("previews and commits a full visible source store before swap", () => {
		const result = run(
			Effect.gen(function* () {
				const { owner, source } = yield* setupFx();
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
		});
		expect(result.outcome).toMatchObject({
			kind: DropItemResultKind.StoreInput,
			lineId,
			inputIndex: 0,
			source: {
				itemId: "runtime:water",
				canonicalItemId: "water",
				previousLocation: sourceLocation(1),
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

	it("admits only a valid exact input request before a compatible authored merge", () => {
		const result = run(
			Effect.gen(function* () {
				const { owner, source } = yield* setupFx();
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
		});
		expect(result.outcome).toMatchObject({
			kind: DropItemResultKind.StoreInput,
			source: {
				current: null,
			},
		});
		expect(result.runtime.items.filter((item) => item.location.scope === "input").length).toBe(
			1,
		);
	});

	it("preserves ordinary swap when the target has no selected default line", () => {
		const result = run(
			Effect.gen(function* () {
				const owner = yield* spawnItemFx({
					id: "runtime:workshop",
					itemId: "workshop",
					location: workshopLocation,
				});
				const source = yield* spawnItemFx({
					id: "runtime:water",
					itemId: "water",
					location: sourceLocation(1),
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
				const { owner, source } = yield* setupFx();
				yield* storeInputMaterialFx({
					ownerItemId: owner.id,
					lineId,
					inputIndex: 0,
					sourceItemId: "runtime:water",
					sourceItemRevision: source.revision,
				});
				for (let index = 0; index < 2; index++) {
					const filler = yield* spawnItemFx({
						id: `filler-${index}`,
						itemId: "water",
						location: sourceLocation(1),
					});
					yield* storeInputMaterialFx({
						ownerItemId: owner.id,
						lineId,
						inputIndex: 0,
						sourceItemId: filler.id,
						sourceItemRevision: filler.revision,
					});
				}

				const extra = yield* spawnItemFx({
					id: "runtime:water-extra",
					itemId: "water",
					location: sourceLocation(1),
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
				const { owner, source } = yield* setupFx();
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

it("stores the exact identity on a full Board without requiring another cell", () => {
	const sourceBoardLocation = {
		scope: "board" as const,
		space: 0,
		position: {
			x: 1,
			y: 0,
		},
	};
	const result = run(
		Effect.gen(function* () {
			const owner = yield* spawnItemFx({
				id: "runtime:workshop",
				itemId: "workshop",
				location: workshopLocation,
			});
			const source = yield* spawnItemFx({
				id: "runtime:water",
				itemId: "water",
				location: sourceBoardLocation,
			});
			const target = targetFor({
				revision: owner.revision,
			});
			const preview = yield* readDropItemPreviewFx({
				sourceItemId: source.id,
				sourceRevision: source.revision,
				sourceLocation: sourceBoardLocation,
				target,
			});
			const before = yield* readRuntimeFx();
			const dropped = yield* Effect.result(
				dropItemFx({
					sourceItemId: source.id,
					sourceRevision: source.revision,
					sourceLocation: sourceBoardLocation,
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
	if (result.dropped._tag === "Success")
		expect(result.dropped.success.kind).toBe(DropItemResultKind.StoreInput);
	expect(result.after.items).toHaveLength(2);
	expect(result.after.items.find((item) => item.id === "runtime:water")?.location.scope).toBe(
		"input",
	);
});
