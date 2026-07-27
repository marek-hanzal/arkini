import { Effect } from "effect";
import { match, P } from "ts-pattern";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";

export namespace isItemPureFx {
	export interface Props {
		item: RuntimeItemSchema.Type;
		runtime: RuntimeSchema.Type;
	}
}

export interface ItemPurityIndex {
	readonly inputLineIdsByOwnerId: ReadonlyMap<IdSchema.Type, ReadonlySet<IdSchema.Type>>;
	readonly jobLineIdsByOwnerId: ReadonlyMap<IdSchema.Type, ReadonlySet<IdSchema.Type>>;
	readonly queueLineIdsByOwnerId: ReadonlyMap<IdSchema.Type, ReadonlySet<IdSchema.Type>>;
}

const addOwnedLine = (
	index: Map<IdSchema.Type, Set<IdSchema.Type>>,
	ownerItemId: IdSchema.Type,
	lineId: IdSchema.Type,
) => {
	const lineIds = index.get(ownerItemId);
	if (lineIds === undefined) {
		index.set(
			ownerItemId,
			new Set([
				lineId,
			]),
		);
	} else {
		lineIds.add(lineId);
	}
};

/** Indexes identity-bound line state once for repeated purity checks over one runtime snapshot. */
export const readItemPurityIndex = (runtime: RuntimeSchema.Type): ItemPurityIndex => {
	const inputLineIdsByOwnerId = new Map<IdSchema.Type, Set<IdSchema.Type>>();
	const jobLineIdsByOwnerId = new Map<IdSchema.Type, Set<IdSchema.Type>>();
	const queueLineIdsByOwnerId = new Map<IdSchema.Type, Set<IdSchema.Type>>();
	for (const item of runtime.items) {
		if (item.location.scope !== LocationScopeEnumSchema.enum.Input) continue;
		addOwnedLine(inputLineIdsByOwnerId, item.location.ownerItemId, item.location.lineId);
	}
	for (const job of runtime.jobs) {
		addOwnedLine(jobLineIdsByOwnerId, job.ownerItemId, job.lineId);
	}
	for (const request of runtime.jobQueue ?? []) {
		addOwnedLine(queueLineIdsByOwnerId, request.ownerItemId, request.lineId);
	}
	return {
		inputLineIdsByOwnerId,
		jobLineIdsByOwnerId,
		queueLineIdsByOwnerId,
	};
};

const readOwnedLines = (item: RuntimeItemSchema.Type): readonly LineSchema.Type[] =>
	match(item.item)
		.with(
			{
				type: ItemEnumSchema.enum.Producer,
			},
			({ lines }) => lines,
		)
		.with(
			{
				type: P.union(
					ItemEnumSchema.enum.Blueprint,
					ItemEnumSchema.enum.Craft,
					ItemEnumSchema.enum.Stash,
				),
			},
			({ line }) => [
				line,
			],
		)
		.otherwise(() => []);

/** Reads item purity from a pre-indexed immutable runtime snapshot. */
export const isItemPure = ({
	index,
	item,
	runtime,
}: {
	readonly index: ItemPurityIndex;
	readonly item: RuntimeItemSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) => {
	if (
		item.remainingCharges !== undefined ||
		item.remainingDurationMs !== undefined ||
		runtime.defaultLineByOwnerItemId?.[item.id] !== undefined
	) {
		return false;
	}
	const inputLineIds = index.inputLineIdsByOwnerId.get(item.id);
	const jobLineIds = index.jobLineIdsByOwnerId.get(item.id);
	const queueLineIds = index.queueLineIdsByOwnerId.get(item.id);
	return readOwnedLines(item).every(
		(line) =>
			inputLineIds?.has(line.id) !== true &&
			jobLineIds?.has(line.id) !== true &&
			queueLineIds?.has(line.id) !== true,
	);
};

/** Returns whether one live item owns no identity-bound runtime state. */
export const isItemPureFx = Effect.fn("isItemPureFx")(function* ({
	item,
	runtime,
}: isItemPureFx.Props) {
	return isItemPure({
		index: readItemPurityIndex(runtime),
		item,
		runtime,
	});
});
