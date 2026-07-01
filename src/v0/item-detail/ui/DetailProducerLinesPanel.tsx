import { Fragment, type FC, useState } from "react";
import { readActivationInputViewFillableQuantity } from "~/v0/board/logic/readActivationInputViewFillableQuantity";
import { readActivationInputViewLabel } from "~/v0/board/logic/readActivationInputViewLabel";
import { readActivationInputViewReady } from "~/v0/board/logic/readActivationInputViewReady";
import type { ProducerProductLineView } from "~/v0/board/view/ProducerProductLineViewSchema";
import { ItemInlineAsset } from "~/v0/item/ui/ItemInlineAsset";
import type { ItemCatalogView } from "~/v0/item/view/ItemCatalogViewSchema";
import { readDetailEffectRequirementLabel } from "~/v0/item-detail/ui/readDetailEffectRequirementLabel";
import { readDetailItemName } from "~/v0/item-detail/ui/readDetailItemName";
import { formatMs } from "~/v0/time/formatMs";
import { UiButton } from "~/v0/ui/UiButton";
import { UiProgressButton } from "~/v0/ui/UiProgressButton";
import { cn } from "~/v0/ui/cn";
import type { DetailProducerLineModel } from "~/v0/item-detail/control/DetailProducerLineModel";
import { DetailCard, DetailMutedPill, DetailTabs } from "~/v0/item-detail/ui/DetailCard";
import {
	effectDetailPolarityTabs,
	readEffectDetailPolarityClassName,
	readEffectDetailPolarityLabel,
	type EffectDetailPolarity,
} from "~/v0/item-detail/ui/effectDetailPresentation";

export namespace DetailProducerLinesPanel {
	export interface Props {
		items: ItemCatalogView;
		lines: readonly DetailProducerLineModel[];
	}
}

const formatMultiplier = (value: number) => value.toFixed(2).replace(/\.?0+$/, "");

const formatPercent = (value: number) => {
	const percent = value * 100;
	const rounded = Math.round(percent * 10) / 10;
	return `${rounded.toFixed(rounded % 1 === 0 ? 0 : 1)}%`;
};

const readQuantityLabel = (
	quantity: NonNullable<ProducerProductLineView["outputs"]>[number]["quantity"],
) => {
	const resolvedQuantity = quantity ?? 1;
	return typeof resolvedQuantity === "number"
		? `${resolvedQuantity}×`
		: `${resolvedQuantity.min}-${resolvedQuantity.max}×`;
};

const readOutputProbabilityLabel = (
	output: NonNullable<ProducerProductLineView["outputs"]>[number],
) => {
	if (output.probability === undefined) {
		return output.kind === "guaranteed" ? "guaranteed" : undefined;
	}

	return output.kind === "weighted"
		? `${formatPercent(output.probability)}/roll`
		: `${formatPercent(output.probability)} chance`;
};

const readOutputMeta = (output: NonNullable<ProducerProductLineView["outputs"]>[number]) =>
	[
		output.enabled === false ? "disabled" : undefined,
		readQuantityLabel(output.quantity),
		readOutputProbabilityLabel(output),
		output.rollLabel,
		`Owned ${output.ownedQuantity}`,
	]
		.filter(Boolean)
		.join(" · ");

const readOutputEffectLines = (output: NonNullable<ProducerProductLineView["outputs"]>[number]) =>
	(output.effects ?? []).map((effect) => `${effect.label}: ${effect.result}`);

const readEffectRequirementPrefix = (
	requirement: NonNullable<ProducerProductLineView["effectRequirements"]>[number],
) => (requirement.kind === "grant.blockStart" ? "Blocked by" : "Missing");

const readVisibleEffectRequirements = (line: ProducerProductLineView) =>
	(line.effectRequirements ?? []).filter((requirement) => !requirement.ready);

const readLineEffectPolarity = (
	line: ProducerProductLineView,
): EffectDetailPolarity | undefined => {
	if (line.lineKind !== "effect") return undefined;
	return line.effectPolarity;
};

const readTargetLimitLabel = (
	limit: NonNullable<ProducerProductLineView["targetLimits"]>[number],
	items: ItemCatalogView,
) => {
	const itemName = readDetailItemName({
		itemId: limit.itemId,
		items,
	});
	const baseLabel = `${itemName} ${limit.ownedQuantity}/${limit.maxCount}`;
	return limit.remainingQuantity < limit.requiredQuantity
		? `${baseLabel} · limit reached`
		: baseLabel;
};

const readProducerInputRowClassName = ({
	available,
	fulfilled,
}: {
	available: boolean;
	fulfilled: boolean;
}) =>
	cn(
		"flex min-w-0 items-center gap-2 rounded-sm border px-2.5 py-2 text-xs transition-[background,border-color,box-shadow]",
		fulfilled
			? "border-emerald-300/30 bg-emerald-400/10 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.07)]"
			: available
				? "border-fuchsia-300/35 bg-fuchsia-400/10 shadow-[inset_0_0_0_1px_rgba(236,72,153,0.07)]"
				: "border-transparent bg-ak-surface/80",
	);

const DetailLineNoteList: FC<{
	items: readonly string[];
	title: string;
	tone?: "good" | "warn" | "neutral";
}> = ({ items, title, tone = "neutral" }) => {
	if (items.length === 0) return null;

	return (
		<div
			className={cn(
				"rounded-sm px-2.5 py-2 text-xs",
				tone === "good" && "bg-emerald-400/12 text-emerald-50",
				tone === "warn" && "bg-rose-400/14 text-rose-50",
				tone === "neutral" && "bg-violet-300/10",
			)}
		>
			<p className="font-black text-ak-text">{title}</p>
			<ul className="mt-1 space-y-1 leading-5 text-ak-text-muted">
				{items.map((item, index) => (
					<li
						key={`${title}:${index}:${item}`}
						className="break-words"
					>
						{item}
					</li>
				))}
			</ul>
		</div>
	);
};

const DetailLineOutputs: FC<{
	items: ItemCatalogView;
	line: ProducerProductLineView;
}> = ({ items, line }) => {
	const outputs = line.outputs ?? [];
	if (outputs.length === 0) return null;

	return (
		<div className="rounded-sm bg-ak-surface/80 px-2.5 py-2 text-xs">
			<p className="font-black text-ak-text">Outputs</p>
			<div className="mt-1.5 grid gap-1.5">
				{outputs.map((output, outputIndex) => {
					const outputItem = items[output.itemId];
					return (
						<div
							key={`${line.productId}:output:${output.itemId}:${outputIndex}`}
							className="flex min-w-0 items-center gap-2"
						>
							<ItemInlineAsset
								item={outputItem}
								className="h-9 w-9"
							/>
							<div className="min-w-0 flex-1">
								<p className="break-words font-black text-ak-text">
									{outputItem?.name ??
										readDetailItemName({
											itemId: output.itemId,
											items,
										})}
								</p>
								<p
									className={cn(
										"mt-0.5 break-words leading-5",
										output.enabled === false
											? "text-rose-200"
											: "text-ak-text-muted",
									)}
								>
									{readOutputMeta(output)}
								</p>
								{readOutputEffectLines(output).length ? (
									<ul className="mt-1 space-y-0.5 leading-5 text-ak-text-muted">
										{readOutputEffectLines(output).map(
											(effectLine, effectLineIndex) => (
												<li
													key={`${line.productId}:output:${outputIndex}:effect:${effectLineIndex}`}
													className="break-words"
												>
													{readDetailEffectRequirementLabel({
														items,
														label: effectLine,
													})}
												</li>
											),
										)}
									</ul>
								) : null}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
};

const DetailLineInputs: FC<{
	items: ItemCatalogView;
	model: DetailProducerLineModel;
}> = ({ items, model }) => {
	const { control, line } = model;
	if (line.inputs.length === 0) return null;

	return (
		<div className="grid gap-2">
			{line.inputs.map((input) => {
				const inputItem = items[input.itemId];
				const fillableQuantity = readActivationInputViewFillableQuantity(input);
				const ready = readActivationInputViewReady(input);
				const withdrawAction = control.withdrawInputActionsByItemId[input.itemId];
				const meta = [
					readActivationInputViewLabel(input),
					fillableQuantity > 0 ? `+${fillableQuantity} available` : undefined,
					input.capacity > input.quantity ? `cap ${input.capacity}` : undefined,
				]
					.filter(Boolean)
					.join(" · ");

				return (
					<div
						key={input.itemId}
						className={readProducerInputRowClassName({
							available: fillableQuantity > 0,
							fulfilled: ready,
						})}
					>
						<ItemInlineAsset
							item={inputItem}
							className="h-9 w-9"
						/>
						<div className="min-w-0 flex-1">
							<p className="break-words font-black text-ak-text">
								{inputItem?.name ??
									readDetailItemName({
										itemId: input.itemId,
										items,
									})}
							</p>
							<p
								className={cn(
									"mt-0.5 break-words leading-5",
									ready ? "font-bold text-emerald-300" : "text-ak-text-muted",
								)}
							>
								{meta}
							</p>
						</div>
						{withdrawAction ? (
							<UiButton
								data-ui="withdraw action"
								disabled={withdrawAction.disabled}
								fullWidth={false}
								tone={withdrawAction.tone}
								onClick={withdrawAction.onClick}
							>
								{withdrawAction.label}
							</UiButton>
						) : null}
					</div>
				);
			})}
		</div>
	);
};

const DetailProducerLineCard: FC<{
	items: ItemCatalogView;
	model: DetailProducerLineModel;
}> = ({ items, model }) => {
	const { control, line } = model;
	const effectPolarity = readLineEffectPolarity(line);
	const visibleRequirements = readVisibleEffectRequirements(line);
	const targetLimits = line.targetLimits ?? [];
	const effectBenefits = line.effectBenefits ?? [];
	const effectBonusLines = line.effectBonusLines ?? [];
	const effectRequirementTitle = visibleRequirements.some(
		(requirement) => requirement.kind === "grant.blockStart",
	)
		? "Blocked effects"
		: "Missing effects";
	const effectRequirementLabels = visibleRequirements.map(
		(requirement) =>
			`${readEffectRequirementPrefix(requirement)} ${readDetailEffectRequirementLabel({
				items,
				label: requirement.label,
			})}`,
	);
	const showInputs = !line.inputsReady && !line.inProgress;
	const meta = [
		line.lineKind === "effect"
			? `Window ${formatMs(line.durationMs)}`
			: `Queue ${line.producerQueuedJobs}/${line.queueSize}`,
		line.lineKind === "product" ? formatMs(line.durationMs) : undefined,
		line.effectDurationMultiplier && line.effectDurationMultiplier < 1
			? `faster ${formatMultiplier(line.effectDurationMultiplier)}×`
			: line.effectDurationMultiplier && line.effectDurationMultiplier > 1
				? `slowed ${formatMultiplier(line.effectDurationMultiplier)}×`
				: undefined,
	]
		.filter(Boolean)
		.join(" · ");

	return (
		<article className="min-w-0">
			<header className="flex min-w-0 items-start justify-between gap-3">
				<div className="min-w-0 flex-1">
					<div className="flex min-w-0 flex-wrap items-center gap-1.5">
						<p className="mr-auto break-words text-base font-black leading-6 text-ak-text">
							{line.name}
						</p>
						{line.isDefault ? <DetailMutedPill>Default</DetailMutedPill> : null}
						{effectPolarity ? (
							<DetailMutedPill
								className={readEffectDetailPolarityClassName(effectPolarity)}
							>
								{readEffectDetailPolarityLabel(effectPolarity)}
							</DetailMutedPill>
						) : null}
					</div>
					<p className="mt-1 break-words text-xs leading-5 text-ak-text-muted">{meta}</p>
				</div>
			</header>

			<div className="mt-3 grid gap-2">
				<DetailLineNoteList
					items={effectBenefits}
					title="Effect grants"
					tone="good"
				/>
				<DetailLineNoteList
					items={effectBonusLines}
					title="Active bonuses"
					tone="good"
				/>
				{effectRequirementLabels.length ? (
					<DetailLineNoteList
						items={effectRequirementLabels}
						title={effectRequirementTitle}
						tone="warn"
					/>
				) : null}
				{targetLimits.length ? (
					<DetailLineNoteList
						items={targetLimits.map((limit) => readTargetLimitLabel(limit, items))}
						title="Target limits"
						tone="neutral"
					/>
				) : null}
				<DetailLineOutputs
					items={items}
					line={line}
				/>
				{showInputs ? (
					<DetailLineInputs
						items={items}
						model={model}
					/>
				) : null}
			</div>

			<div className={cn("mt-3 grid gap-2", control.defaultAction && "grid-cols-3")}>
				<UiProgressButton
					disabled={control.primaryAction.disabled}
					progress={control.primaryAction.progress}
					tone={control.primaryAction.tone}
					className={control.defaultAction ? "col-span-2" : undefined}
					onClick={control.primaryAction.onClick}
				>
					{control.primaryAction.label}
				</UiProgressButton>
				{control.defaultAction ? (
					<UiButton
						fullWidth
						disabled={control.defaultAction.disabled}
						tone={control.defaultAction.tone}
						onClick={control.defaultAction.onClick}
					>
						{control.defaultAction.label}
					</UiButton>
				) : null}
			</div>
		</article>
	);
};

export const DetailProducerLinesPanel: FC<DetailProducerLinesPanel.Props> = ({ items, lines }) => {
	const groups = [
		{
			id: "product",
			label: "Products",
			lines: lines.filter(({ line }) => line.lineKind === "product"),
			title: "Product lines",
		},
		...effectDetailPolarityTabs.map((tab) => ({
			id: `effect:${tab.polarity}`,
			label: tab.label,
			lines: lines.filter(
				({ line }) =>
					line.lineKind === "effect" && readLineEffectPolarity(line) === tab.polarity,
			),
			title: tab.title,
		})),
	].filter((group) => group.lines.length > 0);
	const [selectedGroupId, setSelectedGroupId] = useState(groups[0]?.id ?? "product");
	const activeGroup = groups.find((group) => group.id === selectedGroupId) ?? groups[0];

	if (!activeGroup) return null;

	return (
		<DetailCard
			eyebrow="Lines"
			title={activeGroup.title}
		>
			{groups.length > 1 ? (
				<DetailTabs
					items={groups.map((group) => ({
						id: group.id,
						label: group.label,
					}))}
					selectedId={activeGroup.id}
					onSelect={setSelectedGroupId}
				/>
			) : null}
			<div className="mt-2 flex flex-col gap-[0.9rem]">
				{activeGroup.lines.map((model, index) => (
					<Fragment key={model.line.productId}>
						{index > 0 ? (
							<div
								aria-hidden="true"
								className="border-b border-violet-300/25"
								data-ui="detail producer line separator"
							/>
						) : null}
						<DetailProducerLineCard
							items={items}
							model={model}
						/>
					</Fragment>
				))}
			</div>
		</DetailCard>
	);
};
