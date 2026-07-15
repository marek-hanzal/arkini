import { Effect } from "effect";

import { resolveInputMaterialFx } from "~/v1/input/fx/resolveInputMaterialFx";
import { readInputSlotLocationFx } from "~/v1/input/read/readInputSlotLocationFx";
import type { InputMaterialSchema } from "~/v1/input/schema/InputMaterialSchema";
import type { InputCapacityExceededIssueSchema } from "~/v1/input/schema/check/InputCapacityExceededIssueSchema";
import type { InputLineMissingIssueSchema } from "~/v1/input/schema/check/InputLineMissingIssueSchema";
import type { InputOwnerMissingIssueSchema } from "~/v1/input/schema/check/InputOwnerMissingIssueSchema";
import type { InputSelectorMismatchIssueSchema } from "~/v1/input/schema/check/InputSelectorMismatchIssueSchema";
import type { InputSlotInvalidIssueSchema } from "~/v1/input/schema/check/InputSlotInvalidIssueSchema";
import type { InputLocationSchema } from "~/v1/location/schema/InputLocationSchema";
import { isLineInputClosedFx } from "~/v1/line/fx/input/isLineInputClosedFx";
import type { LineInputClosedIssueSchema } from "~/v1/line/schema/check/LineInputClosedIssueSchema";
import { readItemLineFx } from "~/v1/line/fx/readItemLineFx";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { selectorFx } from "~/v1/selector/fx/selectorFx";

export namespace checkRuntimeInputLocationsFx {
	export interface Props {
		runtime: RuntimeSchema.Type;
	}
}

interface LocatedInputItem {
	item: RuntimeItemSchema.Type;
	location: InputLocationSchema.Type;
}

interface ValidInputItem extends LocatedInputItem {
	input: InputMaterialSchema.Type;
}

/**
 * Reports every invalid input-buffer location and material-capacity invariant.
 *
 * Job-owned materials leave the input buffer entirely. Reserved materials return
 * through normal placement; consumed roots remain committed only until completion.
 */
export const checkRuntimeInputLocationsFx = Effect.fn("checkRuntimeInputLocationsFx")(function* ({
	runtime,
}: checkRuntimeInputLocationsFx.Props) {
	const ownerIssues: InputOwnerMissingIssueSchema.Type[] = [];
	const lineIssues: InputLineMissingIssueSchema.Type[] = [];
	const slotIssues: InputSlotInvalidIssueSchema.Type[] = [];
	const selectorIssues: InputSelectorMismatchIssueSchema.Type[] = [];
	const capacityIssues: InputCapacityExceededIssueSchema.Type[] = [];
	const closedIssues: LineInputClosedIssueSchema.Type[] = [];
	const validItems: ValidInputItem[] = [];

	const locatedItems = (yield* Effect.forEach(runtime.items, (item) => {
		return readInputSlotLocationFx({
			item,
		}).pipe(
			Effect.map((location) => {
				return location === undefined
					? undefined
					: ({
							item,
							location,
						} satisfies LocatedInputItem);
			}),
		);
	})).filter((item): item is LocatedInputItem => item !== undefined);

	for (const { item, location } of locatedItems) {
		const owner = runtime.items.find((candidate) => candidate.id === location.ownerItemId);
		if (owner === undefined) {
			ownerIssues.push({
				itemId: item.id,
				location,
				type: "input:owner-missing",
			});
			continue;
		}

		const line = yield* readItemLineFx({
			item: owner.item,
			lineId: location.lineId,
		});
		if (line === undefined) {
			lineIssues.push({
				itemId: item.id,
				location,
				type: "input:line-missing",
			});
			continue;
		}

		const input = line.input[location.inputIndex];
		if (input === undefined || input.type !== "materials") {
			slotIssues.push({
				itemId: item.id,
				location,
				type: "input:slot-invalid",
			});
			continue;
		}

		const matches = yield* selectorFx({
			item: item.item,
			selector: input.selector,
		});
		if (!matches) {
			selectorIssues.push({
				itemId: item.id,
				location,
				type: "input:selector-mismatch",
			});
			continue;
		}

		validItems.push({
			input,
			item,
			location,
		});
	}

	const checkedLocations: InputLocationSchema.Type[] = [];
	for (const current of validItems) {
		const alreadyChecked = checkedLocations.some((location) => {
			return (
				location.ownerItemId === current.location.ownerItemId &&
				location.lineId === current.location.lineId &&
				location.inputIndex === current.location.inputIndex
			);
		});
		if (alreadyChecked) continue;
		checkedLocations.push(current.location);

		const items = validItems.filter((candidate) => {
			return (
				candidate.location.ownerItemId === current.location.ownerItemId &&
				candidate.location.lineId === current.location.lineId &&
				candidate.location.inputIndex === current.location.inputIndex
			);
		});
		const storedQuantity = items.reduce((quantity, candidate) => {
			return quantity + candidate.item.quantity;
		}, 0);
		const closed = yield* isLineInputClosedFx({
			input: current.input,
			ownerItemId: current.location.ownerItemId,
			lineId: current.location.lineId,
			runtime,
		});
		if (closed) {
			closedIssues.push({
				ownerItemId: current.location.ownerItemId,
				lineId: current.location.lineId,
				inputIndex: current.location.inputIndex,
				itemIds: items.map((candidate) => candidate.item.id),
				type: "line:input-closed",
			});
		}
		const resolution = yield* resolveInputMaterialFx({
			input: current.input,
			storedQuantity,
		});
		if (storedQuantity > resolution.maxStoredQuantity) {
			capacityIssues.push({
				ownerItemId: current.location.ownerItemId,
				lineId: current.location.lineId,
				inputIndex: current.location.inputIndex,
				itemIds: items.map((candidate) => candidate.item.id),
				storedQuantity,
				maxStoredQuantity: resolution.maxStoredQuantity,
				type: "input:capacity-exceeded",
			});
		}
	}

	return [
		...ownerIssues,
		...lineIssues,
		...slotIssues,
		...selectorIssues,
		...capacityIssues,
		...closedIssues,
	];
});
