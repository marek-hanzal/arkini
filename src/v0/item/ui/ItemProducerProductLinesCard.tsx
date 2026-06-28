import type { FC, ReactNode } from "react";
import type { ActivationHindranceView } from "~/v0/board/view/ActivationHindranceViewSchema";
import type { ActivationRequirementView } from "~/v0/board/view/ActivationRequirementViewSchema";
import type { ProducerProductLineView } from "~/v0/board/view/ProducerProductLineViewSchema";
import { ItemInlineAsset } from "~/v0/item/ui/ItemInlineAsset";
import { ItemInlineAssetGroup } from "~/v0/item/ui/ItemInlineAssetGroup";
import type { ItemCatalogView } from "~/v0/item/view/ItemCatalogViewSchema";
import { readProducerProductLineRunState } from "~/v0/producer/logic/readProducerProductLineRunState";
import { formatMs } from "~/v0/time/formatMs";
import { UiButton } from "~/v0/ui/UiButton";
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

const readRequirementReady = (requirement: ActivationRequirementView) =>
	requirement.type === "proximity"
		? requirement.satisfied
		: requirement.stored >= requirement.quantity;

const readInputFillableQuantity = (input: ProducerProductLineView["inputs"][number]) =>
	Math.min(Math.max(0, input.quantity - input.stored), input.available ?? 0);

const readHindrancesMultiplier = (hindrances: readonly ActivationHindranceView[]) =>
	hindrances.reduce((total, hindrance) => total * hindrance.durationMultiplier, 1);

const renderRequirementAsset = (
	requirement: ActivationRequirementView,
	items: ItemCatalogView,
): ReactNode => {
	if (requirement.type === "proximity") {
		return (
			<ItemInlineAssetGroup
				itemIds={requirement.itemIds}
				items={items}
				assetClassName="h-7 w-7"
			/>
		);
	}

	return (
		<ItemInlineAsset
			item={items[requirement.itemId]}
			className="h-9 w-9"
		/>
	);
};

const readRequirementLabel = (requirement: ActivationRequirementView, items: ItemCatalogView) => {
	if (requirement.type === "proximity") {
		return requirement.itemIds.map((itemId) => readItemName(itemId, items)).join(" / ");
	}

	return readItemName(requirement.itemId, items);
};

const readRequirementMeta = (requirement: ActivationRequirementView) => {
	if (requirement.type === "stored") {
		return `${requirement.stored}/${requirement.quantity} stored${
			requirement.capacity > requirement.quantity ? ` · cap ${requirement.capacity}` : ""
		}`;
	}

	if (requirement.type === "passive") {
		return `${requirement.stored}/${requirement.quantity} available`;
	}

	const nearestLabel =
		requirement.matchedDistance === undefined
			? undefined
			: `nearest ${requirement.matchedDistance}`;
	const durationLabel =
		requirement.durationMultiplier === undefined || requirement.durationMultiplier <= 1
			? undefined
			: `${formatMultiplier(requirement.durationMultiplier)}× time`;
	return [
		`within ${requirement.distance}`,
		nearestLabel,
		durationLabel,
	]
		.filter(Boolean)
		.join(" · ");
};

const renderHindranceAsset = (hindrance: ActivationHindranceView, items: ItemCatalogView) => {
	if (hindrance.type === "passive") {
		return (
			<ItemInlineAsset
				item={items[hindrance.itemId]}
				className="h-9 w-9"
			/>
		);
	}

	return (
		<ItemInlineAssetGroup
			itemIds={hindrance.itemIds}
			items={items}
			assetClassName="h-7 w-7"
		/>
	);
};

const readHindranceLabel = (hindrance: ActivationHindranceView, items: ItemCatalogView) => {
	if (hindrance.type === "passive") {
		return readItemName(hindrance.itemId, items);
	}

	return hindrance.itemIds.map((itemId) => readItemName(itemId, items)).join(" / ");
};

const readHindranceMeta = (hindrance: ActivationHindranceView, items: ItemCatalogView) => {
	if (hindrance.type === "passive") {
		return `${hindrance.activeQuantity} active · ${hindrance.activeStacks} stack${
			hindrance.activeStacks === 1 ? "" : "s"
		} · ${formatMultiplier(hindrance.durationMultiplier)}× time`;
	}

	const matchLabel = hindrance.matches
		.map((match) => `${readItemName(match.itemId, items)} at ${match.distance}`)
		.join(", ");

	return [
		`within ${hindrance.distance}`,
		`${hindrance.matches.length} active`,
		`${formatMultiplier(hindrance.durationMultiplier)}× time`,
		matchLabel,
	]
		.filter(Boolean)
		.join(" · ");
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

	return (
		<UiSection
			eyebrow="Production"
			title="Product lines"
		>
			<div className="grid gap-2.5">
				{lines.map((line) => {
					const activeHindrances = line.hindrances ?? [];
					const hindranceMultiplier = readHindrancesMultiplier(activeHindrances);
					const runState = readProducerProductLineRunState({
						line,
					});
					const progressLabel = line.pausedAtMs !== undefined ? "Paused" : "Running";

					return (
						<div
							key={line.productId}
							className="min-w-0 rounded-sm border border-ak-border bg-ak-surface p-3"
						>
							<div className="min-w-0">
								<div className="flex min-w-0 items-start gap-2">
									<div className="min-w-0 flex-1">
										<p className="break-words text-base font-bold leading-6 text-ak-text">
											{line.name}
										</p>
										<p className="mt-1 break-words text-xs leading-5 text-ak-text-muted">
											Queue {line.producerQueuedJobs}/{line.queueSize} ·{" "}
											{formatMs(line.durationMs)}
											{hindranceMultiplier > 1
												? ` · hindered ${formatMultiplier(hindranceMultiplier)}×`
												: ""}
											{line.blocked ? " · blocked by effect" : ""}
											{line.inputItemIds.length
												? ` · ${
														line.inputsReady
															? "input ready"
															: line.inputsAvailable
																? "auto-fill ready"
																: runState.inputsPartiallyAvailable
																	? "partial fill ready"
																	: "needs input"
													}`
												: " · tap to run"}
										</p>
									</div>
									{line.isDefault ? (
										<span className="shrink-0 rounded-sm bg-ak-primary/15 px-1.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-ak-primary">
											Default
										</span>
									) : null}
								</div>
							</div>

							{activeHindrances.length ? (
								<div className="mt-2.5 grid gap-1.5">
									{activeHindrances.map((hindrance, hindranceIndex) => (
										<div
											key={`${hindranceIndex}:${readHindranceLabel(hindrance, items)}`}
											className="flex min-w-0 items-start gap-2 rounded-sm bg-rose-500/10 px-2.5 py-2 text-xs"
										>
											{renderHindranceAsset(hindrance, items)}
											<div className="min-w-0 flex-1">
												<p className="break-words font-semibold text-ak-text">
													{readHindranceLabel(hindrance, items)}
												</p>
												<p className="mt-0.5 break-words leading-5 text-ak-text-muted">
													{readHindranceMeta(hindrance, items)}
												</p>
											</div>
											<span className="mt-0.5 shrink-0 text-rose-300">⚠</span>
										</div>
									))}
								</div>
							) : null}

							{line.requirements?.length ? (
								<div className="mt-2.5 grid gap-1.5">
									{line.requirements.map((requirement, requirementIndex) => {
										const ready = readRequirementReady(requirement);
										return (
											<div
												key={`${requirementIndex}:${readRequirementLabel(requirement, items)}`}
												className="flex min-w-0 items-start gap-2 rounded-sm bg-ak-surface-soft px-2.5 py-2 text-xs"
											>
												{renderRequirementAsset(requirement, items)}
												<div className="min-w-0 flex-1">
													<p className="break-words font-semibold text-ak-text">
														{readRequirementLabel(requirement, items)}
													</p>
													<p className="mt-0.5 break-words leading-5 text-ak-text-muted">
														{readRequirementMeta(requirement)}
													</p>
												</div>
												<span className="mt-0.5 shrink-0 text-ak-text-muted">
													{ready ? "ready" : "missing"}
												</span>
											</div>
										);
									})}
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
															readItemName(input.itemId, items)}
													</p>
													<p className="mt-0.5 break-words leading-5 text-ak-text-muted">
														{input.stored}/{input.quantity}
														{readInputFillableQuantity(input) > 0
															? ` · +${readInputFillableQuantity(input)} available`
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

							{line.inProgress && !line.deliveryBlocked ? (
								<div className="mt-2.5 rounded-sm bg-ak-surface-soft p-2.5">
									<div className="flex justify-between gap-3 text-sm font-bold text-ak-primary">
										<span>
											{progressLabel}
											{line.queuedJobs > 1
												? ` +${line.queuedJobs - 1} queued`
												: ""}
										</span>
										<span>
											{line.remainingMs !== undefined
												? formatMs(line.remainingMs)
												: "Queued"}
										</span>
									</div>
									<div className="mt-2 h-1.5 overflow-hidden rounded-sm bg-ak-surface">
										<div
											className="h-full rounded-sm bg-ak-primary transition-[width] duration-200 ease-linear"
											style={{
												width: `${Math.round((line.progress ?? 0) * 100)}%`,
											}}
										/>
									</div>
								</div>
							) : null}

							<div
								className={
									canSetDefault
										? "mt-2.5 grid grid-cols-3 gap-2"
										: "mt-2.5 grid gap-2"
								}
							>
								<UiButton
									disabled={!runState.canRunAction || pending}
									tone={runState.canRunAction ? "primary" : "secondary"}
									className={canSetDefault ? "col-span-2" : undefined}
									onClick={() => onStart(line.productId)}
								>
									{runState.label}
								</UiButton>
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
	);
};
