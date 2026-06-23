import type { FC, ReactNode } from "react";
import type { ActivationInputView } from "~/v0/board/view/ActivationInputViewSchema";
import type { ActivationRequirementView } from "~/v0/board/view/ActivationRequirementViewSchema";
import type { ExclusiveItemRuleView } from "~/v0/board/view/ExclusiveItemRuleViewSchema";
import { ItemInlineAsset } from "~/v0/item/ui/ItemInlineAsset";
import { ItemInlineAssetGroup } from "~/v0/item/ui/ItemInlineAssetGroup";
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

const readInputSatisfied = (input: ActivationInputView) => input.stored >= input.quantity;

interface DetailRow {
	key: string;
	label: string;
	meta?: string;
	satisfied: boolean;
	tone: "warning" | "success" | "danger";
	asset: ReactNode;
}

const readRequirementRow = (
	requirement: ActivationRequirementView,
	items: ItemCatalogView,
	index: number,
): DetailRow => {
	if (requirement.type === "stored") {
		return {
			key: `requirement:${index}`,
			label: items[requirement.itemId]?.name ?? requirement.itemId,
			meta: `${requirement.stored}/${requirement.capacity} stored · needs ${requirement.quantity}`,
			satisfied: readRequirementSatisfied(requirement),
			tone: readRequirementSatisfied(requirement) ? "success" : "danger",
			asset: (
				<ItemInlineAsset
					item={items[requirement.itemId]}
					className="h-9 w-9"
				/>
			),
		};
	}

	if (requirement.type === "passive") {
		return {
			key: `requirement:${index}`,
			label: items[requirement.itemId]?.name ?? requirement.itemId,
			meta: `${requirement.stored}/${requirement.quantity} available`,
			satisfied: readRequirementSatisfied(requirement),
			tone: readRequirementSatisfied(requirement) ? "success" : "danger",
			asset: (
				<ItemInlineAsset
					item={items[requirement.itemId]}
					className="h-9 w-9"
				/>
			),
		};
	}

	const itemLabel = requirement.itemIds
		.map((itemId) => items[itemId]?.name ?? itemId)
		.join(" / ");
	const distanceLabel = `Within ${requirement.distance} tile${requirement.distance === 1 ? "" : "s"}`;
	const matchedDistance =
		requirement.matchedDistance === undefined
			? undefined
			: `nearest ${requirement.matchedDistance}`;
	const durationEffect =
		requirement.durationMultiplier === undefined || requirement.durationMultiplier <= 1
			? undefined
			: `${formatMultiplier(requirement.durationMultiplier)}× time`;
	const meta = [
		distanceLabel,
		matchedDistance,
		durationEffect,
	]
		.filter(Boolean)
		.join(" · ");

	return {
		key: `requirement:${index}`,
		label: itemLabel,
		meta,
		satisfied: readRequirementSatisfied(requirement),
		tone: readRequirementSatisfied(requirement) ? "success" : "danger",
		asset: (
			<ItemInlineAssetGroup
				itemIds={requirement.itemIds}
				items={items}
				assetClassName="h-7 w-7"
			/>
		),
	};
};

const readExclusiveChoiceRow = (
	rule: ExclusiveItemRuleView,
	items: ItemCatalogView,
): DetailRow => ({
	key: `exclusive:${rule.itemId}`,
	label: items[rule.itemId]?.name ?? rule.itemId,
	meta: rule.blocked ? "Blocked: cannot coexist" : "Choice: will block when placed",
	satisfied: !rule.blocked,
	tone: rule.blocked ? "danger" : "warning",
	asset: (
		<ItemInlineAsset
			item={items[rule.itemId]}
			className="h-9 w-9"
		/>
	),
});

const readInputRow = (input: ActivationInputView, items: ItemCatalogView): DetailRow => {
	const capacityLabel = input.capacity > input.quantity ? `cap ${input.capacity}` : undefined;
	const availableLabel =
		input.stored < input.quantity && input.available
			? `+${input.available} available`
			: undefined;
	const consumeLabel = input.consume ? "consumed at start" : "returned or kept";
	const meta = [
		`${input.stored}/${input.quantity}`,
		capacityLabel,
		availableLabel,
		consumeLabel,
	]
		.filter(Boolean)
		.join(" · ");

	return {
		key: `input:${input.itemId}`,
		label: items[input.itemId]?.name ?? input.itemId,
		meta,
		satisfied: readInputSatisfied(input),
		tone: readInputSatisfied(input) ? "success" : "danger",
		asset: (
			<ItemInlineAsset
				item={items[input.itemId]}
				className="h-9 w-9"
			/>
		),
	};
};

export const ItemRequirementRulesCard: FC<ItemRequirementRulesCard.Props> = ({
	exclusiveTo = [],
	items,
	inputs = [],
	requirements = [],
	title,
}) => {
	const rows: readonly DetailRow[] = [
		...exclusiveTo.map((rule) => readExclusiveChoiceRow(rule, items)),
		...requirements.map((requirement, index) => readRequirementRow(requirement, items, index)),
		...inputs.map((input) => readInputRow(input, items)),
	];

	if (rows.length === 0) return null;

	return (
		<UiSection title={title}>
			<div className="grid gap-2">
				{rows.map((row) => (
					<div
						key={row.key}
						className="flex min-w-0 items-start gap-2 rounded-sm bg-ak-surface px-2.5 py-2 text-sm"
					>
						{row.asset}
						<div className="min-w-0 flex-1">
							<p className="break-words font-semibold text-ak-text">{row.label}</p>
							{row.meta ? (
								<p className="mt-0.5 break-words text-xs leading-5 text-ak-text-muted">
									{row.meta}
								</p>
							) : null}
						</div>
						<span
							aria-hidden="true"
							className={
								row.tone === "warning"
									? "mt-0.5 shrink-0 text-amber-300"
									: row.satisfied
										? "mt-0.5 shrink-0 text-emerald-300"
										: "mt-0.5 shrink-0 text-rose-300"
							}
						>
							{row.tone === "warning" ? "⚠" : row.satisfied ? "✓" : "✕"}
						</span>
					</div>
				))}
			</div>
		</UiSection>
	);
};
