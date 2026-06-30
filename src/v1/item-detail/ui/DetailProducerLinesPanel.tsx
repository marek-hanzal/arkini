import { type FC, useState } from "react";
import { readActivationInputViewFillableQuantity } from "~/v0/board/logic/readActivationInputViewFillableQuantity";
import { readActivationInputViewLabel } from "~/v0/board/logic/readActivationInputViewLabel";
import type { ProducerProductLineView } from "~/v0/board/view/ProducerProductLineViewSchema";
import { ItemInlineAsset } from "~/v0/item/ui/ItemInlineAsset";
import type { ItemCatalogView } from "~/v0/item/view/ItemCatalogViewSchema";
import { readProducerProductLineRunState } from "~/v0/producer/logic/readProducerProductLineRunState";
import { formatMs } from "~/v0/time/formatMs";
import { UiButton } from "~/v0/ui/UiButton";
import { UiProgressButton } from "~/v0/ui/UiProgressButton";
import { cn } from "~/v0/ui/cn";
import { DetailCard, DetailMutedPill, DetailTabs } from "~/v1/item-detail/ui/DetailCard";
import {
	effectDetailPolarityTabs,
	readEffectDetailPolarityClassName,
	readEffectDetailPolarityLabel,
	type EffectDetailPolarity,
} from "~/v1/item-detail/ui/effectDetailPresentation";

export namespace DetailProducerLinesPanel {
	export interface Props {
		canSetDefault?: boolean;
		items: ItemCatalogView;
		lines: readonly ProducerProductLineView[];
		pending: boolean;
		onSetDefault(productId: string): void;
		onStart(productId: string): void;
		onWithdrawInput(productId: string, itemId: string): void;
	}
}

type LineRunState = ReturnType<typeof readProducerProductLineRunState>;

const formatMultiplier = (value: number) => value.toFixed(2).replace(/\.?0+$/, "");

const formatPercent = (value: number) => {
	const percent = value * 100;
	const rounded = Math.round(percent * 10) / 10;
	return `${rounded.toFixed(rounded % 1 === 0 ? 0 : 1)}%`;
};

const readItemName = (itemId: string, items: ItemCatalogView) =>
	items[itemId]?.name ??
	itemId
		.replace(/^item:/, "")
		.replace(/^producer:/, "")
		.replaceAll("-", " ");

const readQuantityLabel = (
	quantity: NonNullable<ProducerProductLineView["outputs"]>[number]["quantity"],
) => {
	const resolvedQuantity = quantity ?? 1;
	return typeof resolvedQuantity === "number"
		? `${resolvedQuantity}×`
		: `${resolvedQuantity.min}-${resolvedQuantity.max}×`;
};

const readOutputMeta = (output: NonNullable<ProducerProductLineView["outputs"]>[number]) =>
	[
		readQuantityLabel(output.quantity),
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

const readLineActionLabel = ({
	line,
	runState,
}: {
	line: ProducerProductLineView;
	runState: LineRunState;
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

const readLineProgressDisplay = (line: ProducerProductLineView) => {
	const progress = line.progress ?? 0;
	return line.lineKind === "effect" ? 1 - progress : progress;
};

const readDefaultActionLabel = (line: ProducerProductLineView) =>
	line.isDefault ? "Un-default" : "Default";

const readEffectRequirementPrefix = (
	requirement: NonNullable<ProducerProductLineView["effectRequirements"]>[number],
) => (requirement.kind === "grant.blockStart" ? "Blocked by" : "Missing");

const readVisibleEffectRequirements = (line: ProducerProductLineView) =>
	(line.effectRequirements ?? []).filter((requirement) =>
		requirement.kind === "grant.blockStart" ? !requirement.ready : !requirement.ready,
	);

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
	const itemName = readItemName(limit.itemId, items);
	const baseLabel = `${itemName} ${limit.ownedQuantity}/${limit.maxCount}`;
	return limit.remainingQuantity < limit.requiredQuantity
		? `${baseLabel} · limit reached`
		: baseLabel;
};

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
			<ul className="mt-1 max-h-28 space-y-1 overflow-y-auto pr-1 leading-5 text-ak-text-muted [scrollbar-width:thin]">
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
			<div className="mt-1.5 grid max-h-40 gap-1.5 overflow-y-auto pr-1 [scrollbar-width:thin]">
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
									{outputItem?.name ?? readItemName(output.itemId, items)}
								</p>
								<p className="mt-0.5 break-words leading-5 text-ak-text-muted">
									{readOutputMeta(output)}
								</p>
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
	line: ProducerProductLineView;
	onWithdrawInput(productId: string, itemId: string): void;
	pending: boolean;
}> = ({ items, line, onWithdrawInput, pending }) => {
	if (line.inputs.length === 0) return null;

	return (
		<div className="grid max-h-64 gap-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
			{line.inputs.map((input) => {
				const inputItem = items[input.itemId];
				const fillableQuantity = readActivationInputViewFillableQuantity(input);
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
						className="flex min-w-0 items-center gap-2 rounded-sm bg-ak-surface/80 px-2.5 py-2 text-xs"
					>
						<ItemInlineAsset
							item={inputItem}
							className="h-9 w-9"
						/>
						<div className="min-w-0 flex-1">
							<p className="break-words font-black text-ak-text">
								{inputItem?.name ?? readItemName(input.itemId, items)}
							</p>
							<p className="mt-0.5 break-words leading-5 text-ak-text-muted">
								{meta}
							</p>
						</div>
						{input.stored > 0 ? (
							<UiButton
								data-ui="withdraw action"
								disabled={pending}
								fullWidth={false}
								onClick={() => onWithdrawInput(line.productId, input.itemId)}
							>
								Withdraw
							</UiButton>
						) : null}
					</div>
				);
			})}
		</div>
	);
};

const DetailProducerLineCard: FC<{
	canSetDefault: boolean;
	items: ItemCatalogView;
	line: ProducerProductLineView;
	onSetDefault(productId: string): void;
	onStart(productId: string): void;
	onWithdrawInput(productId: string, itemId: string): void;
	pending: boolean;
}> = ({ canSetDefault, items, line, onSetDefault, onStart, onWithdrawInput, pending }) => {
	const runState = readProducerProductLineRunState({
		line,
	});
	const effectPolarity = readLineEffectPolarity(line);
	const visibleRequirements = readVisibleEffectRequirements(line);
	const targetLimits = line.targetLimits ?? [];
	const effectBenefits = line.effectBenefits ?? [];
	const effectBonusLines = line.effectBonusLines ?? [];
	const meta = [
		line.lineKind === "effect"
			? `Window ${formatMs(line.durationMs)}`
			: `Queue ${line.producerQueuedJobs}/${line.queueSize}`,
		line.lineKind === "product" ? formatMs(line.durationMs) : undefined,
		line.effectDurationMultiplier && line.effectDurationMultiplier > 1
			? `slowed ${formatMultiplier(line.effectDurationMultiplier)}×`
			: undefined,
		runState.statusMetaLabel,
		runState.inputAvailabilityLabel,
	]
		.filter(Boolean)
		.join(" · ");

	return (
		<article className="min-w-0 rounded-sm bg-ak-surface-soft p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.035)]">
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
				<DetailLineOutputs
					items={items}
					line={line}
				/>
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
				{visibleRequirements.length ? (
					<DetailLineNoteList
						items={visibleRequirements.map(
							(requirement) =>
								`${readEffectRequirementPrefix(requirement)} ${requirement.label}`,
						)}
						title="Blocked requirements"
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
				<DetailLineInputs
					items={items}
					line={line}
					onWithdrawInput={onWithdrawInput}
					pending={pending}
				/>
			</div>

			<div className={cn("mt-3 grid gap-2", canSetDefault && "grid-cols-3")}>
				<UiProgressButton
					disabled={runState.showProgress || !runState.canRunAction || pending}
					progress={runState.showProgress ? readLineProgressDisplay(line) : undefined}
					progressAutoCompleteMs={runState.progressAutoCompleteMs}
					progressAutoCompleteTo={line.lineKind === "effect" ? "empty" : "full"}
					tone="primary"
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
						tone="secondary"
						onClick={() => onSetDefault(line.productId)}
					>
						{readDefaultActionLabel(line)}
					</UiButton>
				) : null}
			</div>
		</article>
	);
};

export const DetailProducerLinesPanel: FC<DetailProducerLinesPanel.Props> = ({
	canSetDefault = true,
	items,
	lines,
	onSetDefault,
	onStart,
	onWithdrawInput,
	pending,
}) => {
	const groups = [
		{
			id: "product",
			label: "Products",
			lines: lines.filter((line) => line.lineKind === "product"),
			title: "Product lines",
		},
		...effectDetailPolarityTabs.map((tab) => ({
			id: `effect:${tab.polarity}`,
			label: tab.label,
			lines: lines.filter(
				(line) =>
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
			action={<DetailMutedPill>{lines.length}</DetailMutedPill>}
		>
			{groups.length > 1 ? (
				<DetailTabs
					items={groups.map((group) => ({
						count: group.lines.length,
						id: group.id,
						label: group.label,
					}))}
					selectedId={activeGroup.id}
					onSelect={setSelectedGroupId}
				/>
			) : null}
			<div className="mt-2 grid max-h-[30rem] gap-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
				{activeGroup.lines.map((line) => (
					<DetailProducerLineCard
						key={line.productId}
						canSetDefault={canSetDefault}
						items={items}
						line={line}
						onSetDefault={onSetDefault}
						onStart={onStart}
						onWithdrawInput={onWithdrawInput}
						pending={pending}
					/>
				))}
			</div>
		</DetailCard>
	);
};
