import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~/engine/game/fx/useGameFx";
import { storeInputMaterialFx } from "~/engine/input/write/storeInputMaterialFx";
import { setDefaultLineFx } from "~/engine/line/write/setDefaultLineFx";
import { readDropItemPreviewFx } from "~/engine/runtime/read/readDropItemPreviewFx";
import { readRuntimeFx } from "~/engine/runtime/read/readRuntimeFx";
import { DropItemResultKindEnumSchema } from "~/engine/runtime/schema/command/DropItemResultKindEnumSchema";
import { dropItemFx } from "~/engine/runtime/write/dropItemFx";
import { spawnItemFx } from "~/engine/runtime/write/spawnItemFx";
import { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import {
	inputRuntimeTestConfig,
	sourceLocation,
	workshopLocation,
} from "~test/input/support/inputRuntimeTestConfig";

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

const run = <A, E, R>(
	effect: Effect.Effect<A, E, R>,
	config: GameConfigSchema.Type = inputRuntimeTestConfig,
) =>
	Effect.runSync(
		effect.pipe(
			useGameFx({
				config,
			}),
		) as Effect.Effect<A, E, never>,
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
		if (owner === undefined || source === undefined) throw new Error("Missing drop setup items.");
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
		target: targetFor({ revision: ownerRevision }),
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
		target: targetFor({ revision: ownerRevision }),
	});

describe("dropItemFx default-line input storage", () => {
	it("previews and commits a full visible source store before swap", () => {
		const result = run(
			Effect.gen(function* () {
				const { owner, source } = yield* setupFx({ quantity: 2 });
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
			kind: DropItemResultKindEnumSchema.enum.StoreInput,
			lineId,
			inputIndex: 0,
			quantity: 2,
		});
		expect(result.outcome).toMatchObject({
			kind: DropItemResultKindEnumSchema.enum.StoreInput,
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
				const { owner, source } = yield* setupFx({ quantity: 7 });
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
			kind: DropItemResultKindEnumSchema.enum.StoreInput,
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
				return { outcome, preview };
			}),
		);

		expect(result.preview).toEqual({
			kind: DropItemResultKindEnumSchema.enum.Swap,
		});
		expect(result.outcome.kind).toBe(DropItemResultKindEnumSchema.enum.Swap);
	});

	it("falls back to swap when the selected input has no remaining capacity", () => {
		const result = run(
			Effect.gen(function* () {
				const { owner, source } = yield* setupFx({ quantity: 5 });
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
					target: targetFor({ revision: currentOwner.revision }),
				});
			}),
		);

		expect(result).toEqual({
			kind: DropItemResultKindEnumSchema.enum.Swap,
		});
	});

	it("keeps authored merge precedence over default-line input storage", () => {
		const result = run(
			Effect.gen(function* () {
				const { owner, source } = yield* setupFx({ quantity: 1 });
				return yield* previewFx({
					ownerRevision: owner.revision,
					sourceRevision: source.revision,
				});
			}),
			mergeBeforeInputConfig,
		);

		expect(result).toEqual({
			kind: DropItemResultKindEnumSchema.enum.Merge,
		});
	});
});
