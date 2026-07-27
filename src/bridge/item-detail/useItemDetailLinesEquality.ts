import { useMemo } from "react";
import { match } from "ts-pattern";

import type { ItemDetailLines } from "~/bridge/item-detail/ItemDetailLines";

/** Owns the structural equality boundary that keeps live Item Detail line projections stable. */
export const useItemDetailLinesEquality = () =>
	useMemo(() => {
		const sameBounds = (
			left: ItemDetailLines.QuantityBounds,
			right: ItemDetailLines.QuantityBounds,
		) => left.min === right.min && left.max === right.max;
		const sameCharge = (
			left: ItemDetailLines.ChargeCost | undefined,
			right: ItemDetailLines.ChargeCost | undefined,
		) => left?.cost === right?.cost && left?.from === right?.from;
		const sameSelector = (left: ItemDetailLines.Selector, right: ItemDetailLines.Selector) =>
			left.kind === right.kind && left.label === right.label;
		const sameDetailReference = (
			left: ItemDetailLines.DetailReference | undefined,
			right: ItemDetailLines.DetailReference | undefined,
		) =>
			left?.itemId === right?.itemId &&
			left?.title === right?.title &&
			left?.sourceUrl === right?.sourceUrl &&
			left?.compositeUrl === right?.compositeUrl &&
			left?.detailItemId === right?.detailItemId;
		const sameDisabledCondition = (
			left: ItemDetailLines.DisabledCondition,
			right: ItemDetailLines.DisabledCondition,
		) =>
			left.kind === right.kind &&
			sameSelector(left.selector, right.selector) &&
			sameDetailReference(left.detail, right.detail) &&
			match(left)
				.with(
					{
						kind: "exists",
					},
					() => right.kind === "exists",
				)
				.with(
					{
						kind: "count",
					},
					(condition) => right.kind === "count" && condition.count === right.count,
				)
				.with(
					{
						kind: "range",
					},
					(condition) =>
						right.kind === "range" &&
						condition.min === right.min &&
						condition.max === right.max,
				)
				.exhaustive();
		const sameStringArray = (left: readonly string[], right: readonly string[]) =>
			left.length === right.length && left.every((value, index) => value === right[index]);
		const sameInput = (left: ItemDetailLines.Input, right: ItemDetailLines.Input) => {
			if (left.kind !== right.kind) return false;
			return match(left)
				.with(
					{
						kind: "materials",
					},
					(materials) =>
						right.kind === "materials" &&
						materials.inputIndex === right.inputIndex &&
						sameSelector(materials.selector, right.selector) &&
						materials.mode === right.mode &&
						sameBounds(materials.required, right.required) &&
						materials.storedQuantity === right.storedQuantity &&
						materials.maxStoredQuantity === right.maxStoredQuantity &&
						materials.missingQuantity === right.missingQuantity &&
						materials.availableCapacity === right.availableCapacity &&
						materials.ready === right.ready &&
						materials.canWithdraw === right.canWithdraw &&
						sameCharge(materials.charges, right.charges) &&
						sameDetailReference(materials.detail, right.detail),
				)
				.with(
					{
						kind: "deposit",
					},
					(deposit) =>
						right.kind === "deposit" &&
						sameSelector(deposit.selector, right.selector) &&
						deposit.distance === right.distance &&
						deposit.requiredCharges === right.requiredCharges &&
						deposit.availableCharges === right.availableCharges &&
						deposit.availableChargesLabel === right.availableChargesLabel &&
						sameStringArray(deposit.targetTitles, right.targetTitles) &&
						deposit.ready === right.ready &&
						sameCharge(deposit.charges, right.charges) &&
						sameDetailReference(deposit.detail, right.detail),
				)
				.with(
					{
						kind: "simple",
					},
					(simple) =>
						right.kind === "simple" &&
						simple.count === right.count &&
						simple.ready === right.ready &&
						sameCharge(simple.charges, right.charges),
				)
				.exhaustive();
		};
		const sameOutputItem = (
			left: ItemDetailLines.OutputItem,
			right: ItemDetailLines.OutputItem,
		) =>
			left.itemId === right.itemId &&
			left.title === right.title &&
			left.sourceUrl === right.sourceUrl &&
			left.compositeUrl === right.compositeUrl &&
			left.definitionItemId === right.definitionItemId &&
			sameBounds(left.quantity, right.quantity);
		const sameOutputItems = (
			left: readonly ItemDetailLines.OutputItem[],
			right: readonly ItemDetailLines.OutputItem[],
		) =>
			left.length === right.length &&
			left.every(
				(item, index) => right[index] !== undefined && sameOutputItem(item, right[index]),
			);
		const sameOutputRoll = (
			left: ItemDetailLines.OutputRoll,
			right: ItemDetailLines.OutputRoll,
		) => {
			if (left.kind !== right.kind) return false;
			return match(left)
				.with(
					{
						kind: "guaranteed",
					},
					(guaranteed) =>
						right.kind === "guaranteed" && sameOutputItems(guaranteed.item, right.item),
				)
				.with(
					{
						kind: "chance",
					},
					(chance) =>
						right.kind === "chance" &&
						chance.chance === right.chance &&
						sameOutputItems(chance.item, right.item),
				)
				.with(
					{
						kind: "weight",
					},
					(weight) =>
						right.kind === "weight" &&
						sameBounds(weight.selections, right.selections) &&
						weight.option.length === right.option.length &&
						weight.option.every((option, index) => {
							const candidate = right.option[index];
							return (
								candidate !== undefined &&
								option.weight === candidate.weight &&
								sameOutputItems(option.item, candidate.item)
							);
						}),
				)
				.exhaustive();
		};
		const sameAvailability = (
			left: ItemDetailLines.Availability,
			right: ItemDetailLines.Availability,
		) => {
			if (left.kind !== right.kind) return false;
			if (left.kind === "available" && right.kind === "available") {
				return left.readiness === right.readiness;
			}
			if (left.kind !== "unavailable" || right.kind !== "unavailable") return false;
			if (left.reason.kind !== right.reason.kind) return false;
			if (left.reason.kind === "line-disabled" && right.reason.kind === "line-disabled") {
				if (left.reason.cause.kind !== right.reason.cause.kind) return false;
				if (
					left.reason.cause.kind === "enable-rule" &&
					right.reason.cause.kind === "enable-rule" &&
					(left.reason.cause.ruleIndex !== right.reason.cause.ruleIndex ||
						left.reason.cause.whenIndex !== right.reason.cause.whenIndex ||
						!sameDisabledCondition(
							left.reason.cause.condition,
							right.reason.cause.condition,
						))
				) {
					return false;
				}
				if (
					left.reason.cause.kind === "disable-rule" &&
					right.reason.cause.kind === "disable-rule"
				) {
					const rightConditions = right.reason.cause.condition;
					if (
						left.reason.cause.ruleIndex !== right.reason.cause.ruleIndex ||
						left.reason.cause.condition.length !== rightConditions.length ||
						left.reason.cause.condition.some((condition, index) => {
							const candidate = rightConditions[index];
							return (
								candidate === undefined ||
								!sameDisabledCondition(condition, candidate)
							);
						})
					) {
						return false;
					}
				}
			}
			if (
				left.reason.kind === "deposit-target-missing" &&
				right.reason.kind === "deposit-target-missing"
			) {
				return (
					left.reason.message === right.reason.message &&
					left.reason.distance === right.reason.distance &&
					sameSelector(left.reason.selector, right.reason.selector) &&
					sameDetailReference(left.reason.detail, right.reason.detail)
				);
			}
			return (
				left.reason.message === right.reason.message &&
				("messageBeforeDetail" in left.reason
					? "messageBeforeDetail" in right.reason &&
						left.reason.messageBeforeDetail === right.reason.messageBeforeDetail &&
						left.reason.messageAfterDetail === right.reason.messageAfterDetail
					: !("messageBeforeDetail" in right.reason)) &&
				("itemId" in left.reason
					? "itemId" in right.reason &&
						left.reason.itemId === right.reason.itemId &&
						left.reason.liveQuantity === right.reason.liveQuantity &&
						left.reason.reservedQuantity === right.reason.reservedQuantity &&
						left.reason.maxCount === right.reason.maxCount &&
						left.reason.messageAfterTitle === right.reason.messageAfterTitle
					: !("itemId" in right.reason)) &&
				("intermediateItemId" in left.reason
					? "intermediateItemId" in right.reason &&
						left.reason.intermediateItemId === right.reason.intermediateItemId
					: !("intermediateItemId" in right.reason))
			);
		};
		const sameLine = (left: ItemDetailLines.Line, right: ItemDetailLines.Line) =>
			left.lineId === right.lineId &&
			left.title === right.title &&
			left.description === right.description &&
			left.baseRuntimeMs === right.baseRuntimeMs &&
			left.effectiveRuntimeMs === right.effectiveRuntimeMs &&
			left.startMode === right.startMode &&
			left.isDefault === right.isDefault &&
			left.actions.canAutofill === right.actions.canAutofill &&
			left.actions.canStart === right.actions.canStart &&
			left.actions.canWithdraw === right.actions.canWithdraw &&
			sameAvailability(left.availability, right.availability) &&
			left.input.length === right.input.length &&
			left.input.every(
				(input, index) =>
					right.input[index] !== undefined && sameInput(input, right.input[index]),
			) &&
			left.output.length === right.output.length &&
			left.output.every((set, index) => {
				const candidate = right.output[index];
				return (
					candidate !== undefined &&
					set.weight === candidate.weight &&
					set.roll.length === candidate.roll.length &&
					set.roll.every(
						(roll, rollIndex) =>
							candidate.roll[rollIndex] !== undefined &&
							sameOutputRoll(roll, candidate.roll[rollIndex]),
					)
				);
			}) &&
			left.activeJob?.status === right.activeJob?.status &&
			left.activeJob?.durationMs === right.activeJob?.durationMs &&
			left.activeJob?.remainingMs === right.activeJob?.remainingMs;
		return (left: ItemDetailLines.Projection, right: ItemDetailLines.Projection) => {
			if (left.kind !== right.kind) return false;
			if (left.kind === "unavailable" || right.kind === "unavailable") return true;
			return (
				left.itemId === right.itemId &&
				left.line.length === right.line.length &&
				left.line.every(
					(line, index) =>
						right.line[index] !== undefined && sameLine(line, right.line[index]),
				)
			);
		};
	}, []);
