import type { FC } from "react";
import type { ActivationInputView } from "~/v0/board/view/ActivationInputViewSchema";
import type { ActivationRequirementView } from "~/v0/board/view/ActivationRequirementViewSchema";
import type { ExclusiveItemRuleView } from "~/v0/board/view/ExclusiveItemRuleViewSchema";
import type { ItemCatalogView } from "~/v0/item/view/ItemCatalogViewSchema";
import { UiSection } from "~/v0/ui/UiSection";

export namespace ItemRequirementRulesCard {
	export interface Props {
		title: string;
		requirements?: readonly ActivationRequirementView[];
		exclusiveTo?: readonly ExclusiveItemRuleView[];
		inputs?: readonly ActivationInputView[];
		items: ItemCatalogView;
	}
}

const formatMultiplier = (value: number) => value.toFixed(2).replace(/\.?0+$/, "");

const readRequirementSatisfied = (requirement: ActivationRequirementView) =>
	requirement.type === "proximity"
		? requirement.satisfied
		: requirement.stored >= requirement.quantity;

const readRequirementLabel = (requirement: ActivationRequirementView, items: ItemCatalogView) => {
	if (requirement.type === "stored") {
		return `${items[requirement.itemId]?.name ?? requirement.itemId} · ${requirement.stored}/${requirement.capacity} stored · needs ${requirement.quantity}`;
	}

	if (requirement.type === "passive") {
		return `${items[requirement.itemId]?.name ?? requirement.itemId} · ${requirement.stored}/${requirement.quantity} available`;
	}

	const itemLabel = requirement.itemIds
		.map((itemId) => items[itemId]?.name ?? itemId)
		.join(" / ");
	const distanceLabel = `within ${requirement.distance} tile${requirement.distance === 1 ? "" : "s"}`;
	const matchedDistance =
		requirement.matchedDistance === undefined
			? ""
			: ` · nearest ${requirement.matchedDistance}`;
	const durationEffect =
		requirement.durationMultiplier === undefined || requirement.durationMultiplier <= 1
			? ""
			: ` · ${formatMultiplier(requirement.durationMultiplier)}× time`;

	return `${itemLabel} · ${distanceLabel}${matchedDistance}${durationEffect}`;
};

const readExclusiveChoiceLabel = (rule: ExclusiveItemRuleView, items: ItemCatalogView) =>
	rule.blocked
		? `Blocked: cannot coexist with ${items[rule.itemId]?.name ?? rule.itemId}`
		: `Choice: will block ${items[rule.itemId]?.name ?? rule.itemId}`;

const readInputSatisfied = (input: ActivationInputView) => input.stored >= input.quantity;

const readInputLabel = (input: ActivationInputView, items: ItemCatalogView) => {
	const itemLabel = items[input.itemId]?.name ?? input.itemId;
	const capacityLabel = input.capacity > input.quantity ? ` · cap ${input.capacity}` : "";
	const availableLabel =
		input.stored < input.quantity && input.available
			? ` · +${input.available} available`
			: "";
	const consumeLabel = input.consume ? " · consumed at start" : " · returned or kept";

	return `${itemLabel} · ${input.stored}/${input.quantity}${capacityLabel}${availableLabel}${consumeLabel}`;
};

export const ItemRequirementRulesCard: FC<ItemRequirementRulesCard.Props> = ({
	exclusiveTo = [],
	items,
	inputs = [],
	requirements = [],
	title,
}) => {
	const openRequirements = requirements.filter(
		(requirement) => !readRequirementSatisfied(requirement),
	);
	const rows = [
		...exclusiveTo.map((rule) => ({
			key: `exclusive:${rule.itemId}`,
			label: readExclusiveChoiceLabel(rule, items),
			satisfied: !rule.blocked,
			tone: rule.blocked ? "danger" : "warning",
		})),
		...openRequirements.map((requirement, index) => ({
			key: `requirement:${index}`,
			label: readRequirementLabel(requirement, items),
			satisfied: false,
			tone: "danger",
		})),
		...inputs.map((input) => ({
			key: `input:${input.itemId}`,
			label: readInputLabel(input, items),
			satisfied: readInputSatisfied(input),
			tone: readInputSatisfied(input) ? "success" : "danger",
		})),
	];

	if (rows.length === 0) return null;

	return (
		<UiSection title={title}>
			<div className="grid gap-2">
				{rows.map((row) => (
					<div
						key={row.key}
						className="flex items-start gap-2 rounded-sm bg-ak-surface px-2.5 py-2 text-sm text-ak-text-muted"
					>
						<span
							aria-hidden="true"
							className={
								row.tone === "warning"
									? "text-amber-300"
									: row.satisfied
										? "text-emerald-300"
										: "text-rose-300"
							}
						>
							{row.tone === "warning" ? "⚠" : row.satisfied ? "✓" : "✕"}
						</span>
						<span className="min-w-0 break-words">{row.label}</span>
					</div>
				))}
			</div>
		</UiSection>
	);
};
