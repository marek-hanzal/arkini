import { Option } from "effect";

import type { DeliveryTargetIssueSchema } from "~/production-delivery/schema/DeliveryTargetIssueSchema";
import { DeliveryTargetIssueReasonEnumSchema } from "~/production-delivery/schema/DeliveryTargetIssueReasonEnumSchema";
import { resolveInputMaterialFn } from "~/production-input/fn/resolveInputMaterialFn";
import { isMaterialInputEligibleFn } from "~/production-input/read/fn/isMaterialInputEligibleFn";
import { TypeSchema } from "~/production-input/schema/TypeSchema";
import { isLineInputClosedFn } from "~/production-line/fn/isLineInputClosedFn";
import { readItemLineFn } from "~/production-line/fn/readItemLineFn";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { isDeliveryRuntimeItemFn } from "~/game-runtime/fn/isDeliveryRuntimeItemFn";
import type { DeliveryRuntimeItemSchema } from "~/game-runtime/schema/DeliveryRuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { RuntimeCheckIssueEnumSchema } from "~/game-runtime/schema/RuntimeCheckIssueEnumSchema";
import { matchesItemSelectorFn } from "~/item-definition/fn/matchesItemSelectorFn";

export namespace checkRuntimeDeliveriesFn {
	export interface Props {
		readonly runtime: RuntimeSchema.Type;
	}
}

interface ValidClaim {
	readonly delivery: DeliveryRuntimeItemSchema.Type;
	readonly inputIndex: number;
	readonly quantity: number;
}

/** Reports invalid targets and claims beyond one slot's authored required maximum. */
export const checkRuntimeDeliveriesFn = ({ runtime }: checkRuntimeDeliveriesFn.Props) => {
	const issues: DeliveryTargetIssueSchema.Type[] = [];
	const validClaims: ValidClaim[] = [];

	for (const item of runtime.items) {
		const delivery = isDeliveryRuntimeItemFn(item);
		if (Option.isNone(delivery)) continue;
		const current = delivery.value;
		if (current.location.phase !== "outbound") continue;
		const { target } = current.location;
		const issue = (
			reason: DeliveryTargetIssueReasonEnumSchema.Type,
		): DeliveryTargetIssueSchema.Type => ({
			itemIds: [
				current.id,
			],
			reason,
			target,
			type: RuntimeCheckIssueEnumSchema.enum.DeliveryTarget,
		});
		const allocationQuantity = target.input.reduce(
			(total, allocation) => total + allocation.quantity,
			0,
		);
		if (allocationQuantity > current.quantity) {
			issues.push(issue(DeliveryTargetIssueReasonEnumSchema.enum.AllocationExceedsQuantity));
		}
		if (
			new Set(target.input.map(({ inputIndex }) => inputIndex)).size !== target.input.length
		) {
			issues.push(issue(DeliveryTargetIssueReasonEnumSchema.enum.AllocationDuplicate));
		}

		const owner = runtime.items.find((candidate) => candidate.id === target.ownerItemId);
		if (owner === undefined) {
			issues.push(issue(DeliveryTargetIssueReasonEnumSchema.enum.OwnerMissing));
			continue;
		}
		if (owner.location.scope !== LocationScopeEnumSchema.enum.Board) {
			issues.push(issue(DeliveryTargetIssueReasonEnumSchema.enum.OwnerNotOnBoard));
			continue;
		}
		const line = readItemLineFn({
			item: owner.item,
			lineId: target.lineId,
		});
		if (line === undefined) {
			issues.push(issue(DeliveryTargetIssueReasonEnumSchema.enum.LineMissing));
			continue;
		}

		for (const allocation of target.input) {
			const input = line.input[allocation.inputIndex];
			if (input === undefined || input.type !== TypeSchema.enum.Materials) {
				issues.push(issue(DeliveryTargetIssueReasonEnumSchema.enum.SlotInvalid));
				continue;
			}
			if (
				!isMaterialInputEligibleFn(current.item) ||
				!matchesItemSelectorFn({
					item: current.item,
					selector: input.selector,
				})
			) {
				issues.push(issue(DeliveryTargetIssueReasonEnumSchema.enum.SelectorMismatch));
				continue;
			}
			if (
				isLineInputClosedFn({
					input,
					ownerItemId: owner.id,
					lineId: line.id,
					runtime,
				})
			) {
				issues.push(issue(DeliveryTargetIssueReasonEnumSchema.enum.SlotClosed));
				continue;
			}
			validClaims.push({
				delivery: current,
				inputIndex: allocation.inputIndex,
				quantity: allocation.quantity,
			});
		}
	}

	const checkedSlots = new Set<string>();
	for (const current of validClaims) {
		const target = current.delivery.location;
		if (target.phase !== "outbound") continue;
		const key = `${target.target.ownerItemId}:${target.target.lineId}:${current.inputIndex}`;
		if (checkedSlots.has(key)) continue;
		checkedSlots.add(key);

		const claims = validClaims.filter((candidate) => {
			const location = candidate.delivery.location;
			return (
				location.phase === "outbound" &&
				location.target.ownerItemId === target.target.ownerItemId &&
				location.target.lineId === target.target.lineId &&
				candidate.inputIndex === current.inputIndex
			);
		});
		const owner = runtime.items.find((candidate) => candidate.id === target.target.ownerItemId);
		if (owner === undefined) continue;
		const line = readItemLineFn({
			item: owner.item,
			lineId: target.target.lineId,
		});
		if (line === undefined) continue;
		const input = line.input[current.inputIndex];
		if (input === undefined || input.type !== TypeSchema.enum.Materials) continue;

		const storedQuantity = runtime.items.reduce((total, candidate) => {
			return candidate.location.scope === LocationScopeEnumSchema.enum.Input &&
				candidate.location.ownerItemId === owner.id &&
				candidate.location.lineId === line.id &&
				candidate.location.inputIndex === current.inputIndex
				? total + candidate.quantity
				: total;
		}, 0);
		const resolution = resolveInputMaterialFn({
			input,
			storedQuantity,
		});
		const claimedQuantity = claims.reduce((total, claim) => total + claim.quantity, 0);
		const remainingTargetQuantity = Math.max(0, resolution.required.max - storedQuantity);
		if (claimedQuantity > remainingTargetQuantity) {
			issues.push({
				itemIds: claims.map(({ delivery }) => delivery.id),
				reason: DeliveryTargetIssueReasonEnumSchema.enum.ClaimsExceedTarget,
				target: target.target,
				type: RuntimeCheckIssueEnumSchema.enum.DeliveryTarget,
			});
		}
	}

	return issues;
};
