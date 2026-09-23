import { Option } from "effect";

import type { DeliveryTargetIssueSchema } from "~/production-delivery/schema/DeliveryTargetIssueSchema";
import { DeliveryTargetIssueReasonEnumSchema } from "~/production-delivery/schema/DeliveryTargetIssueReasonEnumSchema";
import { resolveInputMaterialFn } from "~/production-input/fn/resolveInputMaterialFn";
import { TypeSchema } from "~/production-input/schema/TypeSchema";
import { isLineInputClosedFn } from "~/production-line/fn/isLineInputClosedFn";
import { readItemLineFn } from "~/production-line/fn/readItemLineFn";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { narrowDeliveryRuntimeItemFn } from "~/game-runtime/fn/narrowDeliveryRuntimeItemFn";
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
}

/** Reports invalid targets and claims beyond one slot's authored required maximum. */
export const checkRuntimeDeliveriesFn = ({ runtime }: checkRuntimeDeliveriesFn.Props) => {
	const issues: DeliveryTargetIssueSchema.Type[] = [];
	const validClaims: ValidClaim[] = [];

	for (const item of runtime.items) {
		const delivery = narrowDeliveryRuntimeItemFn(item);
		if (Option.isNone(delivery)) continue;
		const current = delivery.value;
		if (current.location.phase !== "outbound") continue;
		const { target } = current.location;
		const issueFn = (
			reason: DeliveryTargetIssueReasonEnumSchema.Type,
		): DeliveryTargetIssueSchema.Type => ({
			itemIds: [
				current.id,
			],
			reason,
			target,
			type: RuntimeCheckIssueEnumSchema.enum.DeliveryTarget,
		});

		const owner = runtime.items.find((candidate) => candidate.id === target.ownerItemId);
		if (owner === undefined) {
			issues.push(issueFn(DeliveryTargetIssueReasonEnumSchema.enum.OwnerMissing));
			continue;
		}
		if (owner.location.scope !== LocationScopeEnumSchema.enum.Board) {
			issues.push(issueFn(DeliveryTargetIssueReasonEnumSchema.enum.OwnerNotOnBoard));
			continue;
		}
		const line = readItemLineFn({
			item: owner.item,
			lineUid: target.lineUid,
		});
		if (line === undefined) {
			issues.push(issueFn(DeliveryTargetIssueReasonEnumSchema.enum.LineMissing));
			continue;
		}

		{
			const input = line.input[target.inputIndex];
			if (input === undefined || input.type !== TypeSchema.enum.Materials) {
				issues.push(issueFn(DeliveryTargetIssueReasonEnumSchema.enum.SlotInvalid));
				continue;
			}
			if (
				!matchesItemSelectorFn({
					item: current.item,
					selector: input.query.selector,
				})
			) {
				issues.push(issueFn(DeliveryTargetIssueReasonEnumSchema.enum.SelectorMismatch));
				continue;
			}
			if (
				isLineInputClosedFn({
					ownerItemId: owner.id,
					lineUid: line.uid,
					runtime,
				})
			) {
				issues.push(issueFn(DeliveryTargetIssueReasonEnumSchema.enum.SlotClosed));
				continue;
			}
			validClaims.push({
				delivery: current,
				inputIndex: target.inputIndex,
			});
		}
	}

	const checkedSlots = new Set<string>();
	for (const current of validClaims) {
		const target = current.delivery.location;
		if (target.phase !== "outbound") continue;
		const key = JSON.stringify([
			target.target.ownerItemId,
			target.target.lineUid,
			current.inputIndex,
		]);
		if (checkedSlots.has(key)) continue;
		checkedSlots.add(key);

		const claims = validClaims.filter((candidate) => {
			const location = candidate.delivery.location;
			return (
				location.phase === "outbound" &&
				location.target.ownerItemId === target.target.ownerItemId &&
				location.target.lineUid === target.target.lineUid &&
				candidate.inputIndex === current.inputIndex
			);
		});
		const owner = runtime.items.find((candidate) => candidate.id === target.target.ownerItemId);
		if (owner === undefined) continue;
		const line = readItemLineFn({
			item: owner.item,
			lineUid: target.target.lineUid,
		});
		if (line === undefined) continue;
		const input = line.input[current.inputIndex];
		if (input === undefined || input.type !== TypeSchema.enum.Materials) continue;

		const storedQuantity = runtime.items.reduce((total, candidate) => {
			return candidate.location.scope === LocationScopeEnumSchema.enum.Input &&
				candidate.location.ownerItemId === owner.id &&
				candidate.location.lineUid === line.uid &&
				candidate.location.inputIndex === current.inputIndex
				? total + 1
				: total;
		}, 0);
		const resolution = resolveInputMaterialFn({
			input,
			storedQuantity,
		});
		const claimedQuantity = claims.length;
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
