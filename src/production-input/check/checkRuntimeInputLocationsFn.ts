import { RuntimeCheckIssueEnumSchema } from "~/game-runtime/schema/RuntimeCheckIssueEnumSchema";
import { resolveInputMaterialFn } from "~/production-input/fn/resolveInputMaterialFn";
import type { MaterialSchema } from "~/production-input/schema/MaterialSchema";
import type { InputCapacityExceededIssueSchema } from "~/production-input/schema/check/InputCapacityExceededIssueSchema";
import type { InputLineMissingIssueSchema } from "~/production-input/schema/check/InputLineMissingIssueSchema";
import type { InputOwnerMissingIssueSchema } from "~/production-input/schema/check/InputOwnerMissingIssueSchema";
import type { InputSelectorMismatchIssueSchema } from "~/production-input/schema/check/InputSelectorMismatchIssueSchema";
import type { InputSlotInvalidIssueSchema } from "~/production-input/schema/check/InputSlotInvalidIssueSchema";
import type { InputLocationSchema } from "~/item-location/schema/InputLocationSchema";
import { isLineInputClosedFn } from "~/production-line/fn/isLineInputClosedFn";
import type { LineInputClosedIssueSchema } from "~/production-line/schema/check/LineInputClosedIssueSchema";
import { readItemLineFn } from "~/production-line/fn/readItemLineFn";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { matchesItemSelectorFn } from "~/item-definition/fn/matchesItemSelectorFn";
import { TypeSchema } from "~/production-input/schema/TypeSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";

export namespace checkRuntimeInputLocationsFn {
	export interface Props {
		runtime: RuntimeSchema.Type;
	}
}

interface LocatedInputItem {
	item: RuntimeItemSchema.Type;
	location: InputLocationSchema.Type;
}

interface ValidInputItem extends LocatedInputItem {
	input: MaterialSchema.Type;
}

/**
 * Reports every invalid input-buffer location and material-capacity invariant.
 *
 * Job-owned materials leave the input buffer entirely. Reserved live instances
 * relocate through existing-item placement; consumed roots survive only to completion.
 */
export const checkRuntimeInputLocationsFn = ({ runtime }: checkRuntimeInputLocationsFn.Props) => {
	const ownerIssues: InputOwnerMissingIssueSchema.Type[] = [];
	const lineIssues: InputLineMissingIssueSchema.Type[] = [];
	const slotIssues: InputSlotInvalidIssueSchema.Type[] = [];
	const selectorIssues: InputSelectorMismatchIssueSchema.Type[] = [];
	const capacityIssues: InputCapacityExceededIssueSchema.Type[] = [];
	const closedIssues: LineInputClosedIssueSchema.Type[] = [];
	const validItems: ValidInputItem[] = [];

	const locatedItems: LocatedInputItem[] = [];
	for (const item of runtime.items) {
		if (item.location.scope !== LocationScopeEnumSchema.enum.Input) continue;
		locatedItems.push({
			item,
			location: item.location,
		});
	}

	for (const { item, location } of locatedItems) {
		const owner = runtime.items.find((candidate) => candidate.id === location.ownerItemId);
		if (owner === undefined) {
			ownerIssues.push({
				itemId: item.id,
				location,
				type: RuntimeCheckIssueEnumSchema.enum.InputOwnerMissing,
			});
			continue;
		}

		const line = readItemLineFn({
			item: owner.item,
			lineId: location.lineId,
		});
		if (line === undefined) {
			lineIssues.push({
				itemId: item.id,
				location,
				type: RuntimeCheckIssueEnumSchema.enum.InputLineMissing,
			});
			continue;
		}

		const input = line.input[location.inputIndex];
		if (input === undefined || input.type !== TypeSchema.enum.Materials) {
			slotIssues.push({
				itemId: item.id,
				location,
				type: RuntimeCheckIssueEnumSchema.enum.InputSlotInvalid,
			});
			continue;
		}

		const matches = matchesItemSelectorFn({
			item: item.item,
			selector: input.selector,
		});
		if (!matches) {
			selectorIssues.push({
				itemId: item.id,
				location,
				type: RuntimeCheckIssueEnumSchema.enum.InputSelectorMismatch,
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
		const closed = isLineInputClosedFn({
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
				type: RuntimeCheckIssueEnumSchema.enum.LineInputClosed,
			});
		}
		const resolution = resolveInputMaterialFn({
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
				type: RuntimeCheckIssueEnumSchema.enum.InputCapacityExceeded,
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
};
