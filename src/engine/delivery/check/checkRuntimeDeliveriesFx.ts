import { Effect, Option } from "effect";

import type { DeliveryTargetIssueSchema } from "~/engine/delivery/schema/check/DeliveryTargetIssueSchema";
import { DeliveryTargetIssueReasonEnumSchema } from "~/engine/delivery/schema/check/DeliveryTargetIssueReasonEnumSchema";
import type { DeliveryPurposeIssueSchema } from "~/engine/delivery/schema/check/DeliveryPurposeIssueSchema";
import { DeliveryPurposeIssueReasonEnumSchema } from "~/engine/delivery/schema/check/DeliveryPurposeIssueReasonEnumSchema";
import { resolveInputMaterialFx } from "~/engine/input/fx/resolveInputMaterialFx";
import { isMaterialInputEligible } from "~/engine/input/read/readMaterialInputEligibilityFx";
import { InputEnumSchema } from "~/engine/input/schema/InputEnumSchema";
import { isLineInputClosedFx } from "~/engine/line/fx/input/isLineInputClosedFx";
import { readItemLineFx } from "~/engine/line/fx/readItemLineFx";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { isDeliveryRuntimeItemFx } from "~/engine/runtime/read/isDeliveryRuntimeItemFx";
import type { DeliveryRuntimeItemSchema } from "~/engine/runtime/schema/DeliveryRuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { RuntimeCheckIssueEnumSchema } from "~/engine/runtime/schema/check/RuntimeCheckIssueEnumSchema";
import { matchesItemSelector } from "~/engine/selector/fx/selectItemsFx";

export namespace checkRuntimeDeliveriesFx {
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
export const checkRuntimeDeliveriesFx = Effect.fn("checkRuntimeDeliveriesFx")(function* ({
	runtime,
}: checkRuntimeDeliveriesFx.Props) {
	const issues: DeliveryTargetIssueSchema.Type[] = [];
	const purposeIssues: DeliveryPurposeIssueSchema.Type[] = [];
	const validClaims: ValidClaim[] = [];

	for (const item of runtime.items) {
		const delivery = yield* isDeliveryRuntimeItemFx(item);
		if (Option.isNone(delivery)) continue;
		const current = delivery.value;
		const purpose = current.location.purpose;
		if (purpose.kind === "fill-and-try-start") {
			const purposeIssue = (
				reason: DeliveryPurposeIssueReasonEnumSchema.Type,
			): DeliveryPurposeIssueSchema.Type => ({
				itemId: current.id,
				purpose,
				reason,
				type: RuntimeCheckIssueEnumSchema.enum.DeliveryPurpose,
			});
			const owner = runtime.items.find((candidate) => candidate.id === purpose.ownerItemId);
			if (owner === undefined) {
				purposeIssues.push(
					purposeIssue(DeliveryPurposeIssueReasonEnumSchema.enum.OwnerMissing),
				);
			} else if (owner.location.scope !== LocationScopeEnumSchema.enum.Board) {
				purposeIssues.push(
					purposeIssue(DeliveryPurposeIssueReasonEnumSchema.enum.OwnerNotOnBoard),
				);
			} else if (
				(yield* readItemLineFx({
					item: owner.item,
					lineId: purpose.lineId,
				})) === undefined
			) {
				purposeIssues.push(
					purposeIssue(DeliveryPurposeIssueReasonEnumSchema.enum.LineMissing),
				);
			} else if (
				current.location.phase === "outbound" &&
				(current.location.target.ownerItemId !== purpose.ownerItemId ||
					current.location.target.lineId !== purpose.lineId)
			) {
				purposeIssues.push(
					purposeIssue(DeliveryPurposeIssueReasonEnumSchema.enum.TargetMismatch),
				);
			}
		}
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
		const line = yield* readItemLineFx({
			item: owner.item,
			lineId: target.lineId,
		});
		if (line === undefined) {
			issues.push(issue(DeliveryTargetIssueReasonEnumSchema.enum.LineMissing));
			continue;
		}

		for (const allocation of target.input) {
			const input = line.input[allocation.inputIndex];
			if (input === undefined || input.type !== InputEnumSchema.enum.Materials) {
				issues.push(issue(DeliveryTargetIssueReasonEnumSchema.enum.SlotInvalid));
				continue;
			}
			if (
				!isMaterialInputEligible(current.item) ||
				!matchesItemSelector({
					item: current.item,
					selector: input.selector,
				})
			) {
				issues.push(issue(DeliveryTargetIssueReasonEnumSchema.enum.SelectorMismatch));
				continue;
			}
			if (
				yield* isLineInputClosedFx({
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
		const line = yield* readItemLineFx({
			item: owner.item,
			lineId: target.target.lineId,
		});
		if (line === undefined) continue;
		const input = line.input[current.inputIndex];
		if (input === undefined || input.type !== InputEnumSchema.enum.Materials) continue;

		const storedQuantity = runtime.items.reduce((total, candidate) => {
			return candidate.location.scope === LocationScopeEnumSchema.enum.Input &&
				candidate.location.ownerItemId === owner.id &&
				candidate.location.lineId === line.id &&
				candidate.location.inputIndex === current.inputIndex
				? total + candidate.quantity
				: total;
		}, 0);
		const resolution = yield* resolveInputMaterialFx({
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

	const seenIntents = new Set<string>();
	for (const intent of runtime.deliveryStartIntents ?? []) {
		const purpose = {
			kind: "fill-and-try-start" as const,
			...intent,
		};
		const issue = (
			reason: DeliveryPurposeIssueReasonEnumSchema.Type,
		): DeliveryPurposeIssueSchema.Type => ({
			purpose,
			reason,
			type: RuntimeCheckIssueEnumSchema.enum.DeliveryPurpose,
		});
		const key = `${intent.ownerItemId}:${intent.lineId}`;
		if (seenIntents.has(key)) {
			purposeIssues.push(issue(DeliveryPurposeIssueReasonEnumSchema.enum.Duplicate));
			continue;
		}
		seenIntents.add(key);
		const owner = runtime.items.find((candidate) => candidate.id === intent.ownerItemId);
		if (owner === undefined) {
			purposeIssues.push(issue(DeliveryPurposeIssueReasonEnumSchema.enum.OwnerMissing));
			continue;
		}
		if (owner.location.scope !== LocationScopeEnumSchema.enum.Board) {
			purposeIssues.push(issue(DeliveryPurposeIssueReasonEnumSchema.enum.OwnerNotOnBoard));
			continue;
		}
		if (
			(yield* readItemLineFx({
				item: owner.item,
				lineId: intent.lineId,
			})) === undefined
		) {
			purposeIssues.push(issue(DeliveryPurposeIssueReasonEnumSchema.enum.LineMissing));
			continue;
		}
		if (
			intent.source === "autonomous" &&
			!(runtime.autonomousLines ?? []).some(
				(selection) =>
					selection.ownerItemId === intent.ownerItemId &&
					selection.lineId === intent.lineId,
			)
		) {
			purposeIssues.push(issue(DeliveryPurposeIssueReasonEnumSchema.enum.AutonomousDisabled));
		}
	}

	return [
		...issues,
		...purposeIssues,
	];
});
