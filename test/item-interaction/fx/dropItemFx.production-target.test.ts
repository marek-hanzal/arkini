import { Effect, type Layer } from "effect";
import { describe, expect, it } from "vitest";

import { useGameFx } from "~test/support/useGameFx";
import type { GameLayerFx } from "~test/support/GameLayerFx";
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
						itemUid: "workshop",
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
			itemUid: "workshop",
			location: workshopLocation,
		});
		yield* spawnItemFx({
			id: "runtime:water",
			itemUid: "water",
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

const resolveItemOutcomeFx = ({
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

describe("dropItemFx production targets", () => {
	it.each([
		"authored",
		"selected",
	] as const)(
		"swaps compatible material with a producer using its %s default line",
		(selection) => {
			const result = run(
				Effect.gen(function* () {
					const { owner, source } =
						selection === "selected"
							? yield* setupFx()
							: {
									owner: yield* spawnItemFx({
										id: "runtime:workshop",
										itemUid: "workshop",
										location: workshopLocation,
									}),
									source: yield* spawnItemFx({
										id: "runtime:water",
										itemUid: "water",
										location: sourceLocation(1),
									}),
								};
					const props = {
						ownerRevision: owner.revision,
						sourceRevision: source.revision,
					};
					const before = yield* readRuntimeFx();
					const preview = yield* previewFx(props);
					const outcome = yield* resolveItemOutcomeFx(props);
					return {
						before,
						preview,
						outcome,
						runtime: yield* readRuntimeFx(),
					};
				}),
				authoredDefaultConfig,
			);
			expect(result.preview.kind).toBe(DropItemResultKind.Swap);
			expect(result.outcome.kind).toBe(DropItemResultKind.Swap);
			expect(
				result.runtime.items.find((item) => item.id === "runtime:water")?.location,
			).toEqual(workshopLocation);
			expect(
				result.runtime.items.find((item) => item.id === "runtime:workshop")?.location,
			).toEqual(sourceLocation(1));
			expect(result.runtime.items).toHaveLength(2);
			expect(result.runtime.defaultLineByOwnerItemId).toEqual(
				result.before.defaultLineByOwnerItemId,
			);
		},
	);
	it("keeps an explicit source merge ahead of swap on a compatible producer", () => {
		const result = run(
			Effect.gen(function* () {
				const { owner, source } = yield* setupFx();
				const props = {
					ownerRevision: owner.revision,
					sourceRevision: source.revision,
				};
				const preview = yield* previewFx(props);
				const outcome = yield* resolveItemOutcomeFx(props);
				return {
					preview,
					outcome,
					runtime: yield* readRuntimeFx(),
				};
			}),
			mergeBeforeInputConfig,
		);
		expect(result.preview.kind).toBe(DropItemResultKind.Merge);
		expect(result.outcome.kind).toBe(DropItemResultKind.Merge);
		expect(result.runtime.items.map((item) => item.id)).toEqual([
			"runtime:workshop",
		]);
	});
});
