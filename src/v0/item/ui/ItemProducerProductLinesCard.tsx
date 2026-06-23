import type { FC } from "react";
import type { ActivationHindranceView } from "~/v0/board/view/ActivationHindranceViewSchema";
import type { ActivationRequirementView } from "~/v0/board/view/ActivationRequirementViewSchema";
import type { ProducerProductLineView } from "~/v0/board/view/ProducerProductLineViewSchema";
import { readLiveProducerProductLineView } from "~/v0/producer/logic/readLiveProducerProductLineView";
import { formatMs } from "~/v0/time/formatMs";
import type { ItemCatalogView } from "~/v0/item/view/ItemCatalogViewSchema";
import { UiButton } from "~/v0/ui/UiButton";
import { UiSection } from "~/v0/ui/UiSection";

export namespace ItemProducerProductLinesCard {
	export interface Props {
		items: ItemCatalogView;
		lines: readonly ProducerProductLineView[];
		nowMs: number;
		pending: boolean;
		onSetDefault(productId: string): void;
		onStart(productId: string): void;
		onWithdrawInput(productId: string, itemId: string): void;
	}
}

const formatMultiplier = (value: number) => value.toFixed(2).replace(/\.?0+$/, "");

const readItemName = (itemId: string, items: ItemCatalogView) =>
	items[itemId]?.name ?? itemId.replace(/^item:/, "").replace(/^producer:/, "");

const readRequirementLabel = (requirement: ActivationRequirementView, items: ItemCatalogView) => {
	if (requirement.type === "proximity") {
		const itemLabel = requirement.itemIds
			.map((itemId) => readItemName(itemId, items))
			.join(" / ");
		const matchedDistance =
			requirement.matchedDistance === undefined
				? ""
				: ` · nearest ${requirement.matchedDistance}`;
		const durationEffect =
			requirement.durationMultiplier === undefined || requirement.durationMultiplier <= 1
				? ""
				: ` · ${formatMultiplier(requirement.durationMultiplier)}× time`;

		return `${itemLabel} within ${requirement.distance}${matchedDistance}${durationEffect}`;
	}

	return `${readItemName(requirement.itemId, items)} ${requirement.stored}/${requirement.quantity}`;
};

const readRequirementReady = (requirement: ActivationRequirementView) =>
	requirement.type === "proximity"
		? requirement.satisfied
		: requirement.stored >= requirement.quantity;

const readInputFillableQuantity = (input: ProducerProductLineView["inputs"][number]) =>
	Math.min(Math.max(0, input.quantity - input.stored), input.available ?? 0);

const readInputsPartiallyAvailable = (line: ProducerProductLineView) =>
	!line.inputsReady && line.inputs.some((input) => readInputFillableQuantity(input) > 0);

const readHindrancesMultiplier = (hindrances: readonly ActivationHindranceView[]) =>
	hindrances.reduce((total, hindrance) => total * hindrance.durationMultiplier, 1);

const readHindranceLabel = (hindrance: ActivationHindranceView, items: ItemCatalogView) => {
	if (hindrance.type === "passive") {
		return `${readItemName(hindrance.itemId, items)} · ${hindrance.activeQuantity} active · ${hindrance.activeStacks} stack${hindrance.activeStacks === 1 ? "" : "s"} · ${formatMultiplier(hindrance.durationMultiplier)}× time`;
	}

	const itemLabel = hindrance.itemIds.map((itemId) => readItemName(itemId, items)).join(" / ");
	const matchLabel = hindrance.matches
		.map((match) => `${readItemName(match.itemId, items)} at ${match.distance}`)
		.join(", ");

	return `${itemLabel} within ${hindrance.distance} · ${hindrance.matches.length} active · ${formatMultiplier(hindrance.durationMultiplier)}× time · ${matchLabel}`;
};

export const ItemProducerProductLinesCard: FC<ItemProducerProductLinesCard.Props> = ({
	items,
	lines,
	nowMs,
	pending,
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
				{lines.map((baseLine) => {
					const line = readLiveProducerProductLineView({
						line: baseLine,
						nowMs,
					});
					const activeHindrances = line.hindrances ?? [];
					const hindranceMultiplier = readHindrancesMultiplier(activeHindrances);
					const inputsPartiallyAvailable = readInputsPartiallyAvailable(line);
					const canRunAction =
						(line.inputsReady || line.inputsAvailable || inputsPartiallyAvailable) &&
						line.requirementsReady &&
						!line.queueFull;
					const remainingMs = line.readyAtMs
						? Math.max(0, line.readyAtMs - nowMs)
						: undefined;

					return (
						<div
							key={line.productId}
							className="min-w-0 rounded-sm border border-ak-border bg-ak-surface p-3"
						>
							<div className="flex min-w-0 items-start justify-between gap-3">
								<div className="min-w-0">
									<div className="flex min-w-0 items-center gap-2">
										<p className="truncate text-sm font-bold text-ak-text">
											{line.name}
										</p>
										{line.isDefault ? (
											<span className="shrink-0 rounded-sm bg-ak-primary/15 px-1.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-ak-primary">
												Default
											</span>
										) : null}
									</div>
									<p className="mt-1 break-words text-xs leading-5 text-ak-text-muted">
										Queue {line.producerQueuedJobs}/{line.queueSize} ·{" "}
										{formatMs(line.durationMs)}
										{hindranceMultiplier > 1
											? ` · hindered ${formatMultiplier(hindranceMultiplier)}×`
											: ""}
										{line.inputItemIds.length
											? ` · ${
													line.inputsReady
														? "input ready"
														: line.inputsAvailable
															? "auto-fill ready"
															: inputsPartiallyAvailable
																? "partial fill ready"
																: "needs input"
												}`
											: " · tap to run"}
										{line.requirementItemIds.length
											? ` · ${line.requirementItemIds.length} requirement${line.requirementItemIds.length === 1 ? "" : "s"}`
											: ""}
									</p>
								</div>
								<div className="flex shrink-0 items-center gap-2">
									<UiButton
										fullWidth={false}
										disabled={pending}
										onClick={() => onSetDefault(line.productId)}
									>
										{line.isDefault ? "Unset default" : "Make default"}
									</UiButton>
								</div>
							</div>

							{activeHindrances.length ? (
								<div className="mt-2.5 grid gap-1.5">
									{activeHindrances.map((hindrance, hindranceIndex) => (
										<div
											key={`${hindranceIndex}:${readHindranceLabel(hindrance, items)}`}
											className="flex min-w-0 items-start gap-2 rounded-sm bg-rose-500/10 px-2.5 py-2 text-xs text-ak-text-muted"
										>
											<span className="shrink-0 text-rose-300">⚠</span>
											<span className="min-w-0 break-words font-semibold text-ak-text">
												{readHindranceLabel(hindrance, items)}
											</span>
										</div>
									))}
								</div>
							) : null}

							{line.requirements?.some(
								(requirement) => !readRequirementReady(requirement),
							) ? (
								<div className="mt-2.5 grid gap-1.5">
									{line.requirements
										.filter((requirement) => !readRequirementReady(requirement))
										.map((requirement, requirementIndex) => (
											<div
												key={`${requirementIndex}:${readRequirementLabel(requirement, items)}`}
												className="flex min-w-0 items-center justify-between gap-2 rounded-sm bg-ak-surface-soft px-2.5 py-2 text-xs"
											>
												<span className="min-w-0 truncate font-semibold text-ak-text">
													{readRequirementLabel(requirement, items)}
												</span>
												<span className="ml-auto shrink-0 text-ak-text-muted">
													{readRequirementReady(requirement)
														? "ready"
														: "missing"}
												</span>
											</div>
										))}
								</div>
							) : null}

							{line.inputs.length ? (
								<div className="mt-2.5 grid gap-1.5">
									{line.inputs.map((input) => (
										<div
											key={input.itemId}
											className="flex min-w-0 items-center justify-between gap-2 rounded-sm bg-ak-surface-soft px-2.5 py-2 text-xs"
										>
											<span className="min-w-0 truncate font-semibold text-ak-text">
												{readItemName(input.itemId, items)}
											</span>
											<span className="text-ak-text-muted ml-auto shrink-0 tabular-nums">
												{input.stored}/{input.quantity}
												{readInputFillableQuantity(input) > 0
													? ` · +${readInputFillableQuantity(input)} available`
													: ""}
												{input.capacity > input.quantity
													? ` · cap ${input.capacity}`
													: ""}
											</span>
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
									))}
								</div>
							) : null}

							{line.inProgress ? (
								<div className="mt-2.5 rounded-sm bg-ak-surface-soft p-2.5">
									<div className="flex justify-between gap-3 text-sm font-bold text-ak-primary">
										<span>
											Running
											{line.queuedJobs > 1
												? ` +${line.queuedJobs - 1} queued`
												: ""}
										</span>
										<span>
											{remainingMs !== undefined
												? formatMs(remainingMs)
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

							<UiButton
								disabled={!canRunAction || pending}
								tone={canRunAction ? "primary" : "secondary"}
								className="mt-2.5"
								onClick={() => onStart(line.productId)}
							>
								{line.queueFull
									? "Queue full"
									: !line.requirementsReady
										? "Requirements missing"
										: line.inputsReady
											? "Start"
											: line.inputsAvailable
												? "Auto-fill & start"
												: inputsPartiallyAvailable
													? "Partial fill"
													: "Feed items by drag"}
							</UiButton>
						</div>
					);
				})}
			</div>
		</UiSection>
	);
};
