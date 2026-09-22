import { Effect } from "effect";
import { GameConfigSchema } from "~/game-config/schema/GameConfigSchema";
import { storeInputMaterialFx } from "~/production-input/fx/storeInputMaterialFx";
import { startLineFx } from "~test/production-job/support/startLineTestFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { createTemporaryMaterialLifecycleTestConfig } from "../temporaryMaterialLifecycle.test/createTemporaryMaterialLifecycleTestConfig";

export const boardFn = (x: number) => ({
	scope: "board" as const,
	space: 0,
	position: {
		x,
		y: 0,
	},
});

export const prepareMaterialOwnerFx = Effect.fn("prepareMaterialOwnerFx")(function* () {
	yield* spawnItemFx({
		id: "owner",
		itemId: "owner",

		location: boardFn(0),
	});
	const input = yield* spawnItemFx({
		id: "input",
		itemId: "temporary",

		location: boardFn(1),
	});
	yield* storeInputMaterialFx({
		ownerItemId: "owner",
		lineId: "line:owner",
		inputIndex: 0,
		sourceItemId: input.id,
		sourceItemRevision: input.revision,
	});
});

export const startMaterialJobFx = Effect.fn("startMaterialJobFx")(function* () {
	yield* prepareMaterialOwnerFx();
	yield* startLineFx({
		ownerItemId: "owner",
		lineId: "line:owner",
	});
});

export const lastUnitConfigFn = (expiryMode: "loose-kill" | "kill-switch") => {
	const base = createTemporaryMaterialLifecycleTestConfig();
	const owner = base.items.owner!;
	const line = owner.lines[0]!;
	return GameConfigSchema.parse({
		...base,
		items: {
			...base.items,
			owner: {
				...owner,
				units: {
					amount: 1,
					output: base.items.temporary!.clock!.onExpire,
				},
				lines: [
					{
						...line,
						input: line.input.map((input) => ({
							...input,
							units: {
								from: "self",
								cost: 1,
							},
						})),
					},
				],
			},
			temporary: {
				...base.items.temporary,
				clock: {
					...base.items.temporary!.clock,
					expiryMode,
					onExpire: undefined,
				},
			},
		},
	});
};
