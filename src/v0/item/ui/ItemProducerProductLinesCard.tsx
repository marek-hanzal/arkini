import type { FC } from "react";
import { readActivationInputViewFillableQuantity } from "~/v0/board/logic/readActivationInputViewFillableQuantity";
import { readActivationInputViewLabel } from "~/v0/board/logic/readActivationInputViewLabel";
import type { ProducerProductLineView } from "~/v0/board/view/ProducerProductLineViewSchema";
import { ItemInlineAsset } from "~/v0/item/ui/ItemInlineAsset";
import type { ItemCatalogView } from "~/v0/item/view/ItemCatalogViewSchema";
import { readProducerProductLineRunState } from "~/v0/producer/logic/readProducerProductLineRunState";
import { formatMs } from "~/v0/time/formatMs";
import { UiButton } from "~/v0/ui/UiButton";
import { UiProgressButton } from "~/v0/ui/UiProgressButton";
import { UiSection } from "~/v0/ui/UiSection";

export namespace ItemProducerProductLinesCard {
	export interface Props {
		items: ItemCatalogView;
		lines: readonly ProducerProductLineView[];
		pending: boolean;
		canSetDefault?: boolean;
		onSetDefault(productId: string): void;
		onStart(productId: string): void;
		onWithdrawInput(productId: string, itemId: string): void;
	}
}

const formatMultiplier = (value: number) => value.toFixed(2).replace(/\.?0+$/, "");

const readItemName = (itemId: string, items: ItemCatalogView) =>
	items[itemId]?.name ?? itemId.replace(/^item:/, "").replace(/^producer:/, "");

const formatPercent = (value: number) => {
	const percent = value * 100;
	const rounded = Math.round(percent * 10) / 10;
	return `${rounded.toFixed(rounded % 1 === 0 ? 0 : 1)}%`;
};

const readProductLineOutputQuantityLabel = (
	quantity: NonNullable<ProducerProductLineView["outputs"]>[number]["quantity"],
) => {
	const resolvedQuantity = quantity ?? 1;
	return typeof resolvedQuantity === "number"
		? `${resolvedQuantity}×`
		: `${resolvedQuantity.min}-${resolvedQuantity.max}×`;
};

const readProductLineOutputMeta = (
	output: NonNullable<ProducerProductLineView["outputs"]>[number],
) =>
	[
		readProductLineOutputQuantityLabel(output.quantity),
		output.probability === undefined
			? output.kind === "guaranteed"
				? "guaranteed"
				: undefined
			: `${formatPercent(output.probability)} chance`,
		output.rollLabel,
		`Owned ${output.ownedQuantity}`,
	]
		.filter(Boolean)
		.join(" · ");

const readTargetLimitLabel = (
	limit: NonNullable<ProducerProductLineView["targetLimits"]>[number],
	items: ItemCatalogView,
) => {
	const itemName = readItemName(limit.itemId, items);
	const baseLabel = `${itemName} ${limit.ownedQuantity}/${limit.maxCount}`;
	return limit.remainingQuantity < limit.requiredQuantity
		? `${baseLabel} · limit reached`
		: baseLabel;
};

const readLineActionLabel = ({
	line,
	runState,
}: {
	line: ProducerProductLineView;
	runState: ReturnType<typeof readProducerProductLineRunState>;
}) => {
	if (!runState.showProgress) return runState.label;

	const statusLabel =
		line.remainingMs === undefined ? "Queued" : (runState.progressLabel ?? "Running");
	const timeLabel = line.remainingMs === undefined ? undefined : formatMs(line.remainingMs);
	const queuedLabel = line.queuedJobs > 1 ? `+${line.queuedJobs - 1} queued` : undefined;

	return [
		statusLabel,
		timeLabel,
		queuedLabel,
	]
		.filter(Boolean)
		.join(" · ");
};

const readLineKind = (line: ProducerProductLineView) => line.lineKind ?? "product";

const readLineProgressDisplay = (line: ProducerProductLineView) => {
	const progress = line.progress ?? 0;
	return readLineKind(line) === "effect" ? 1 - progress : progress;
};

type EffectPolarity = NonNullable<ProducerProductLineView["effectPolarity"]>;

const effectPolaritySections: readonly {
	polarity: EffectPolarity;
	title: string;
}[] = [
	{
		polarity: "buff",
		title: "Buffs",
	},
	{
		polarity: "debuff",
		title: "Debuffs",
	},
	{
		polarity: "neutral",
		title: "Neutral effects",
	},
	{
		polarity: "mixed",
		title: "Mixed effects",
	},
];

const readEffectPolarity = (line: ProducerProductLineView): EffectPolarity =>
	line.effectPolarity ?? "neutral";

const readEffectPolarityLabel = (polarity: EffectPolarity) => {
	if (polarity === "buff") return "Buff";
	if (polarity === "debuff") return "Debuff";
	if (polarity === "mixed") return "Mixed";
	return "Neutral";
};

const readEffectPolarityBadgeClassName = (polarity: EffectPolarity) => {
	if (polarity === "buff") {
		return "border-ak-success/40 bg-ak-success-soft text-ak-success";
	}
	if (polarity === "debuff") {
		return "border-ak-danger/40 bg-ak-danger-soft text-ak-danger";
	}
	if (polarity === "mixed") {
		return "border-ak-secondary/40 bg-ak-secondary/15 text-ak-secondary";
	}

	return "border-ak-border bg-ak-surface-soft text-ak-text-muted";
};

const readEffectRequirementStateLabel = (
	requirement: NonNullable<ProducerProductLineView["effectRequirements"]>[number],
) => {
	if (requirement.ready) return "✓";
	if (requirement.kind === "grant.blockStart") return "Blocked";
	return "Missing";
};

export const ItemProducerProductLinesCard: FC<ItemProducerProductLinesCard.Props> = ({
	items,
	lines,
	pending,
	canSetDefault = true,
	onSetDefault,
	onStart,
	onWithdrawInput,
}) => {
	if (lines.length === 0) return null;

	const effectLineGroups = effectPolaritySections.map((section) => ({
		eyebrow: "Effects",
		key: `effect:${section.polarity}`,
		lines: lines.filter(
			(line) =>
				readLineKind(line) === "effect" && readEffectPolarity(line) === section.polarity,
		),
		title: section.title,
	}));
	const productLineGroup = {
		eyebrow: "Production",
		key: "product",
		lines: lines.filter((line) => readLineKind(line) === "product"),
		title: "Product lines",
	};
	const lineGroups = [
		...effectLineGroups,
		productLineGroup,
	].filter((group) => group.lines.length > 0);

	return (
		<>
			{lineGroups.map((group) => (
				<UiSection
					key={group.key}
					eyebrow={group.eyebrow}
					title={group.title}
				>
					<div className="grid gap-2.5">
						{group.lines.map((line) => {
							const runState = readProducerProductLineRunState({
								line,
							});
							const outputs = line.outputs ?? [];
							const targetLimits = line.targetLimits ?? [];
							const effectBenefits = line.effectBenefits ?? [];
							const effectBonusLines = line.effectBonusLines ?? [];
							const effectRequirements = line.effectRequirements ?? [];
							return (
								<div
									key={line.productId}
									className="min-w-0 rounded-sm border border-ak-border bg-ak-surface p-3"
								>
									<div className="min-w-0">
										<div className="flex min-w-0 items-start gap-2">
											<div className="flex min-w-0 flex-1 items-start gap-2">
												{outputs.length ? (
													<div className="flex max-w-24 shrink-0 flex-wrap gap-1">
														{outputs.map((output, outputIndex) => (
															<ItemInlineAsset
																key={`${output.itemId}:${outputIndex}`}
																item={items[output.itemId]}
																className="h-8 w-8"
															/>
														))}
													</div>
												) : readLineKind(line) === "effect" ? (
													<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-ak-primary/15 text-[0.62rem] font-black uppercase tracking-[0.12em] text-ak-primary">
														FX
													</div>
												) : null}
												<div className="min-w-0 flex-1">
													<p className="break-words text-base font-bold leading-6 text-ak-text">
														{line.name}
													</p>
													<p className="mt-1 break-words text-xs leading-5 text-ak-text-muted">
														{readLineKind(line) === "effect"
															? "Window"
															: "Queue"}{" "}
														{readLineKind(line) === "effect"
															? formatMs(line.durationMs)
															: `${line.producerQueuedJobs}/${line.queueSize} · ${formatMs(line.durationMs)}`}
														{line.effectDurationMultiplier &&
														line.effectDurationMultiplier > 1
															? ` · slowed ${formatMultiplier(line.effectDurationMultiplier)}×`
															: ""}
														{runState.statusMetaLabel
															? ` · ${runState.statusMetaLabel}`
															: ""}
														{runState.inputAvailabilityLabel
															? ` · ${runState.inputAvailabilityLabel}`
															: ""}
													</p>
												</div>
											</div>
											<div className="flex shrink-0 flex-wrap justify-end gap-1">
												{readLineKind(line) === "effect" ? (
													<span
														className={`rounded-sm border px-1.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.12em] ${readEffectPolarityBadgeClassName(
															readEffectPolarity(line),
														)}`}
													>
														{readEffectPolarityLabel(
															readEffectPolarity(line),
														)}
													</span>
												) : null}
												{line.isDefault ? (
													<span className="rounded-sm bg-ak-primary/15 px-1.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-ak-primary">
														Default
													</span>
												) : null}
											</div>
										</div>
									</div>

									{outputs.length ? (
										<div className="mt-2.5 rounded-sm bg-ak-surface-soft px-2.5 py-2 text-xs">
											<p className="font-semibold text-ak-text">Outputs</p>
											<ul className="mt-1 grid gap-1.5">
												{outputs.map((output, outputIndex) => {
													const outputItem = items[output.itemId];

													return (
														<li
															key={`${line.productId}:output:${output.itemId}:${outputIndex}`}
															className="flex min-w-0 items-center gap-2"
														>
															<ItemInlineAsset
																item={outputItem}
																className="h-7 w-7"
															/>
															<div className="min-w-0 flex-1">
																<p className="break-words font-semibold text-ak-text">
																	{outputItem?.name ??
																		readItemName(
																			output.itemId,
																			items,
																		)}
																</p>
																<p className="mt-0.5 break-words leading-5 text-ak-text-muted">
																	{readProductLineOutputMeta(
																		output,
																	)}
																</p>
															</div>
														</li>
													);
												})}
											</ul>
										</div>
									) : null}

									{targetLimits.length ? (
										<div className="mt-2.5 rounded-sm bg-ak-surface-soft px-2.5 py-2 text-xs">
											<p className="font-semibold text-ak-text">
												Target limit
											</p>
											<ul className="mt-1 grid gap-1 leading-5 text-ak-text-muted">
												{targetLimits.map((limit) => (
													<li
														key={`${line.productId}:target-limit:${limit.itemId}`}
														className="break-words"
													>
														{readTargetLimitLabel(limit, items)}
													</li>
												))}
											</ul>
										</div>
									) : null}

									{effectBenefits.length ? (
										<div className="mt-2.5 rounded-sm bg-ak-primary/10 px-2.5 py-2 text-xs">
											<p className="font-semibold text-ak-text">Benefit</p>
											<ul className="mt-1 grid gap-1 leading-5 text-ak-text-muted">
												{effectBenefits.map((benefit, benefitIndex) => (
													<li
														key={`${line.productId}:benefit:${benefitIndex}`}
														className="break-words"
													>
														{benefit}
													</li>
												))}
											</ul>
										</div>
									) : null}

									{effectBonusLines.length ? (
										<div className="mt-2.5 rounded-sm bg-ak-primary/10 px-2.5 py-2 text-xs">
											<p className="font-semibold text-ak-text">
												Active bonus
											</p>
											<ul className="mt-1 grid gap-1 leading-5 text-ak-text-muted">
												{effectBonusLines.map((bonusLine, bonusIndex) => (
													<li
														key={`${line.productId}:effect-bonus:${bonusIndex}`}
														className="break-words"
													>
														{bonusLine}
													</li>
												))}
											</ul>
										</div>
									) : null}

									{effectRequirements.length ? (
										<div className="mt-2.5 rounded-sm bg-ak-surface-soft px-2.5 py-2 text-xs">
											<p className="font-semibold text-ak-text">
												Requirements
											</p>
											<ul className="mt-1 grid gap-1 leading-5 text-ak-text-muted">
												{effectRequirements.map(
													(requirement, requirementIndex) => (
														<li
															key={`${line.productId}:effect-requirement:${requirementIndex}`}
															className="break-words"
														>
															{readEffectRequirementStateLabel(
																requirement,
															)}{" "}
															{requirement.label}
														</li>
													),
												)}
											</ul>
										</div>
									) : null}

									{line.inputs.length ? (
										<div className="mt-2.5 grid gap-1.5">
											{line.inputs.map((input) => {
												const inputItem = items[input.itemId];
												return (
													<div
														key={input.itemId}
														className="flex min-w-0 items-center gap-2 rounded-sm bg-ak-surface-soft px-2.5 py-2 text-xs"
													>
														<ItemInlineAsset
															item={inputItem}
															className="h-9 w-9"
														/>
														<div className="min-w-0 flex-1">
															<p className="break-words font-semibold text-ak-text">
																{inputItem?.name ??
																	readItemName(
																		input.itemId,
																		items,
																	)}
															</p>
															<p className="mt-0.5 break-words leading-5 text-ak-text-muted">
																{readActivationInputViewLabel(
																	input,
																)}
																{readActivationInputViewFillableQuantity(
																	input,
																) > 0
																	? ` · +${readActivationInputViewFillableQuantity(input)} available`
																	: ""}
																{input.capacity > input.quantity
																	? ` · cap ${input.capacity}`
																	: ""}
															</p>
														</div>
														{input.stored > 0 ? (
															<UiButton
																data-ui="withdraw action"
																fullWidth={false}
																disabled={pending}
																onClick={() =>
																	onWithdrawInput(
																		line.productId,
																		input.itemId,
																	)
																}
															>
																Withdraw
															</UiButton>
														) : null}
													</div>
												);
											})}
										</div>
									) : null}

									<div
										className={
											canSetDefault
												? "mt-2.5 grid grid-cols-3 gap-2"
												: "mt-2.5 grid gap-2"
										}
									>
										<UiProgressButton
											disabled={
												runState.showProgress ||
												!runState.canRunAction ||
												pending
											}
											progress={
												runState.showProgress
													? readLineProgressDisplay(line)
													: undefined
											}
											progressAutoCompleteMs={runState.progressAutoCompleteMs}
											progressAutoCompleteTo={
												readLineKind(line) === "effect" ? "empty" : "full"
											}
											tone={
												runState.showProgress || runState.canRunAction
													? "primary"
													: "secondary"
											}
											className={canSetDefault ? "col-span-2" : undefined}
											onClick={() => onStart(line.productId)}
										>
											{readLineActionLabel({
												line,
												runState,
											})}
										</UiProgressButton>
										{canSetDefault ? (
											<UiButton
												fullWidth
												disabled={pending}
												onClick={() => onSetDefault(line.productId)}
											>
												{line.isDefault ? "Un-default" : "Default"}
											</UiButton>
										) : null}
									</div>
								</div>
							);
						})}
					</div>
				</UiSection>
			))}
		</>
	);
};
