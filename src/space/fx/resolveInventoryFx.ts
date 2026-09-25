import { Effect } from "effect";
import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { applyBoardTemplateRuntimeFx } from "~/board-template/fx/applyBoardTemplateRuntimeFx";
import { reviseRuntimeItemFx } from "~/game-runtime/fx/reviseRuntimeItemFx";
import { readAuthoredSpaceIdsFn } from "~/space/fn/readAuthoredSpaceIdsFn";
import { readPhysicalRootOriginFn } from "~/item-location/fn/readPhysicalRootOriginFn";
import type { AppliedOutcome } from "~/outcome/type/AppliedOutcome";

export namespace resolveInventoryFx {
	export interface Props {
		readonly ownerItemId: IdSchema.Type;
		readonly templateUid: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}
	export interface Result {
		readonly space: number;
		readonly runtime: RuntimeSchema.Type;
		readonly initialization?: AppliedOutcome.Template;
	}
}

/** Allocates one room per owner and creating template, in the caller's draft. */
export const resolveInventoryFx = Effect.fn("resolveInventoryFx")(function* ({
	ownerItemId,
	templateUid,
	runtime,
}: resolveInventoryFx.Props) {
	const owner = runtime.items.find(({ id }) => id === ownerItemId);
	if (owner === undefined) return undefined;
	const existingSpace =
		owner.inventories !== undefined && Object.hasOwn(owner.inventories, templateUid)
			? owner.inventories[templateUid]
			: undefined;
	if (existingSpace !== undefined)
		return {
			space: existingSpace,
			runtime,
			initialization: undefined,
		} satisfies resolveInventoryFx.Result;
	const config = yield* GameConfigFx;
	const occupied = new Set(readAuthoredSpaceIdsFn(config));
	const snapshot = yield* (yield* RuntimeFx).read;
	for (const state of [
		snapshot,
		runtime,
	]) {
		occupied.add(state.currentSpace);
		if (state.previousSpace !== undefined) occupied.add(state.previousSpace);
		for (const key of Object.keys(state.templateUidBySpace)) occupied.add(Number(key));
		for (const item of state.items) {
			for (const space of Object.values(item.inventories ?? {})) occupied.add(space);
			const origin = readPhysicalRootOriginFn(item.location);
			if (origin !== undefined) occupied.add(origin.space);
			if (item.location.scope === "delivery" && item.location.phase === "returning")
				occupied.add(item.location.returnFrom.space);
		}
	}
	let space = 0;
	while (occupied.has(space)) space += 1;
	const initialized = yield* applyBoardTemplateRuntimeFx({
		runtime,
		space,
		templateUid,
	});
	const bound = yield* reviseRuntimeItemFx({
		item: {
			...owner,
			inventories: {
				...owner.inventories,
				[templateUid]: space,
			},
		},
	});
	return {
		space,
		runtime: {
			...initialized.runtime,
			items: initialized.runtime.items.map((item) => (item.id === owner.id ? bound : item)),
		},
		initialization: {
			type: "template",
			space,
			templateUid,
			removed: initialized.removed,
		},
	} satisfies resolveInventoryFx.Result;
});
