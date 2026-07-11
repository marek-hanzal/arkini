import { Effect } from "effect";

import { resolveInputMaterialFx } from "~/v1/input/fx/resolveInputMaterialFx";
import type { InputMaterialSchema } from "~/v1/input/schema/InputMaterialSchema";
import type { InputCapacityExceededIssueSchema } from "~/v1/input/schema/check/InputCapacityExceededIssueSchema";
import type { InputLineMissingIssueSchema } from "~/v1/input/schema/check/InputLineMissingIssueSchema";
import type { InputOwnerMissingIssueSchema } from "~/v1/input/schema/check/InputOwnerMissingIssueSchema";
import type { InputSelectorMismatchIssueSchema } from "~/v1/input/schema/check/InputSelectorMismatchIssueSchema";
import type { InputSlotInvalidIssueSchema } from "~/v1/input/schema/check/InputSlotInvalidIssueSchema";
import { readItemLineFx } from "~/v1/line/fx/readItemLineFx";
import { isInputRuntimeItem } from "~/v1/runtime/read/isInputRuntimeItem";
import type { InputRuntimeItemSchema } from "~/v1/runtime/schema/InputRuntimeItemSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { selectorFx } from "~/v1/selector/fx/selectorFx";

export namespace checkRuntimeInputLocationsFx {
	export interface Props {
		runtime: RuntimeSchema.Type;
	}
}

interface ValidInputItem {
	input: InputMaterialSchema.Type;
	item: InputRuntimeItemSchema.Type;
}

/**
 * Reports every invalid line-input location and material-buffer invariant.
 */
export const checkRuntimeInputLocationsFx = Effect.fn("checkRuntimeInputLocationsFx")(function* ({
	runtime,
}: checkRuntimeInputLocationsFx.Props) {
	const ownerIssues: InputOwnerMissingIssueSchema.Type[] = [];
	const lineIssues: InputLineMissingIssueSchema.Type[] = [];
	const slotIssues: InputSlotInvalidIssueSchema.Type[] = [];
	const selectorIssues: InputSelectorMismatchIssueSchema.Type[] = [];
	const capacityIssues: InputCapacityExceededIssueSchema.Type[] = [];
	const validItems: ValidInputItem[] = [];

	for (const item of runtime.items.filter(isInputRuntimeItem)) {
		const owner = runtime.items.find((candidate) => candidate.id === item.location.ownerItemId);
		if (owner === undefined) {
			ownerIssues.push({
				itemId: item.id,
				location: item.location,
				type: "input:owner-missing",
			});
			continue;
		}

		const line = yield* readItemLineFx({
			item: owner.item,
			lineId: item.location.lineId,
		});
		if (line === undefined) {
			lineIssues.push({
				itemId: item.id,
				location: item.location,
				type: "input:line-missing",
			});
			continue;
		}

		const input = line.input[item.location.inputIndex];
		if (input === undefined || input.type !== "materials") {
			slotIssues.push({
				itemId: item.id,
				location: item.location,
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
				location: item.location,
				type: "input:selector-mismatch",
			});
			continue;
		}

		validItems.push({
			input,
			item,
		});
	}

	const checkedLocations: InputRuntimeItemSchema.Type["location"][] = [];
	for (const current of validItems) {
		const alreadyChecked = checkedLocations.some((location) => {
			return (
				location.ownerItemId === current.item.location.ownerItemId &&
				location.lineId === current.item.location.lineId &&
				location.inputIndex === current.item.location.inputIndex
			);
		});
		if (alreadyChecked) {
			continue;
		}
		checkedLocations.push(current.item.location);

		const items = validItems.filter((candidate) => {
			return (
				candidate.item.location.ownerItemId === current.item.location.ownerItemId &&
				candidate.item.location.lineId === current.item.location.lineId &&
				candidate.item.location.inputIndex === current.item.location.inputIndex
			);
		});
		const storedQuantity = items.reduce((quantity, candidate) => {
			return quantity + candidate.item.quantity;
		}, 0);
		const resolution = yield* resolveInputMaterialFx({
			input: current.input,
			storedQuantity,
		});
		if (storedQuantity > resolution.maxStoredQuantity) {
			capacityIssues.push({
				ownerItemId: current.item.location.ownerItemId,
				lineId: current.item.location.lineId,
				inputIndex: current.item.location.inputIndex,
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
	];
});
