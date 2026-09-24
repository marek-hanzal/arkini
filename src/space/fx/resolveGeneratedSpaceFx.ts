import { Effect } from "effect";
import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { applyBoardTemplateRuntimeFx } from "~/board-template/fx/applyBoardTemplateRuntimeFx";
import { reviseRuntimeItemFx } from "~/game-runtime/fx/reviseRuntimeItemFx";
import { readAuthoredSpaceIdsFn } from "~/space/fn/readAuthoredSpaceIdsFn";
import type { AppliedOutcome } from "~/outcome/type/AppliedOutcome";

export namespace resolveGeneratedSpaceFx {
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

/** Allocates and initializes only a surviving live owner's first use, in the caller's draft. */
export const resolveGeneratedSpaceFx = Effect.fn("resolveGeneratedSpaceFx")(function* ({
	ownerItemId,
	templateUid,
	runtime,
}: resolveGeneratedSpaceFx.Props) {
	const owner = runtime.items.find(({ id }) => id === ownerItemId);
	if (owner === undefined) return undefined;
	if (owner.generatedSpace !== undefined)
		return {
			space: owner.generatedSpace,
			runtime,
			initialization: undefined,
		} satisfies resolveGeneratedSpaceFx.Result;
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
			if (item.generatedSpace !== undefined) occupied.add(item.generatedSpace);
			if (item.location.scope === "board") occupied.add(item.location.space);
			if (item.location.scope === "delivery") {
				occupied.add(item.location.origin.space);
				if (item.location.phase === "returning")
					occupied.add(item.location.returnFrom.space);
			}
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
			generatedSpace: space,
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
	} satisfies resolveGeneratedSpaceFx.Result;
});
