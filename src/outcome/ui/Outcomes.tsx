import { Tx } from "~/translation/ui/Tx";
import { Info } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { match } from "ts-pattern";
import type { ReactNode } from "react";

import type { OutcomeProjection } from "~/outcome/type/OutcomeProjection";
import { QuantityValue } from "~/item-definition/ui/QuantityValue";

type OutcomesVariant = "compact" | "editor-tree";

const OutcomeItem = <Item extends OutcomeProjection.Item>({
	item,
	eyebrow,
	renderItemDetailFn,
	renderItemFn,
	variant,
}: {
	readonly item: Item;
	readonly renderItemDetailFn?: (item: Item) => ReactNode;
	readonly renderItemFn: (item: Item, eyebrow?: ReactNode) => ReactNode;
	readonly variant: OutcomesVariant;
	readonly eyebrow?: ReactNode;
}) => (
	<div
		className="grid gap-1.5"
		data-ui="TileLineOutcomeItem"
	>
		<div
			className={twMerge(
				"flex min-w-0 items-center justify-between gap-4 text-sm",
				variant === "editor-tree" && "border-l-2 border-accent",
			)}
		>
			{renderItemFn(item, eyebrow)}
			<span className="shrink-0 text-lg font-bold tabular-nums text-foreground">
				×<QuantityValue quantity={item.quantity} />
			</span>
		</div>
		{item.activeRuleHints.map((hint, index) => (
			<p
				className="flex items-start gap-1.5 text-xs text-muted"
				data-ui="TileLineOutcomeRuleHint"
				key={`${hint}-${index}`}
			>
				<Info className="mt-px size-3.5 shrink-0 text-secondary-foreground" />
				<span>{hint}</span>
			</p>
		))}
		{renderItemDetailFn?.(item)}
	</div>
);

const OutcomeRoll = <Item extends OutcomeProjection.Item>({
	roll,
	renderItemDetailFn,
	renderItemFn,
	variant,
}: {
	readonly roll: OutcomeProjection.Roll<Item>;
	readonly renderItemDetailFn?: (item: Item) => ReactNode;
	readonly renderItemFn: (item: Item, eyebrow?: ReactNode) => ReactNode;
	readonly variant: OutcomesVariant;
}) => {
	const eyebrow = (
		<span className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-muted">
			{match(roll)
				.with(
					{
						kind: "guaranteed",
					},
					() => <Tx label="Guaranteed" />,
				)
				.with(
					{
						kind: "chance",
					},
					({ chance }) => (
						<>
							{Math.round(chance * 100)}% <Tx label="chance" />
						</>
					),
				)
				.exhaustive()}
		</span>
	);
	return (
		<div
			className={variant === "editor-tree" ? "flex flex-col gap-3" : "flex flex-col gap-1.5"}
			data-ui="TileLineOutcomeRoll"
			data-roll-kind={roll.kind}
		>
			{roll.outcome.map((item, index) =>
				item.type !== "item" ? (
					<div
						key={index}
						data-ui="NonItemOutcome"
						className="grid gap-1.5 text-sm"
					>
						<div>
							{eyebrow}
							{item.type === "space" ? (
								<>
									{typeof item.space === "object" ? (
										<>
											<Tx label="Inventory" /> ·{" "}
											{item.templateTitle ?? item.space.templateUid}
										</>
									) : item.space === "previous" ? (
										<Tx label="Previous Space" />
									) : (
										<>
											<Tx label="Space" /> {item.space}
										</>
									)}
								</>
							) : (
								<>
									<Tx label="Template" /> {item.title ?? item.templateUid}
								</>
							)}
						</div>
						{item.activeRuleHints.map((hint, hintIndex) => (
							<p
								key={hintIndex}
								className="text-xs text-muted"
							>
								{hint}
							</p>
						))}
					</div>
				) : (
					<OutcomeItem
						key={index}
						item={item}
						eyebrow={eyebrow}
						renderItemDetailFn={renderItemDetailFn}
						renderItemFn={renderItemFn}
						variant={variant}
					/>
				),
			)}
		</div>
	);
};

/** Renders every authored outcome alternative and roll for one visible product line. */
export const Outcomes = <Item extends OutcomeProjection.Item>({
	emptyLabel = <Tx label="No outcome" />,
	outcome,
	renderItemDetailFn,
	renderItemFn,
	renderSetDetailFn,
	variant = "compact",
}: {
	readonly emptyLabel?: ReactNode;
	readonly outcome: readonly OutcomeProjection.Set<Item>[];
	readonly renderItemDetailFn?: (item: Item) => ReactNode;
	readonly renderItemFn: (item: Item, eyebrow?: ReactNode) => ReactNode;
	readonly renderSetDetailFn?: (set: OutcomeProjection.Set<Item>) => ReactNode;
	readonly variant?: OutcomesVariant;
}) => {
	const totalWeight = outcome.reduce((total, set) => total + set.weight, 0);
	return (
		<section
			className="min-w-0"
			data-ui="Outcomes"
			data-variant={variant}
		>
			{outcome.length === 0 ? (
				<p className="py-3 text-sm text-muted">{emptyLabel}</p>
			) : (
				<div className="flex flex-col gap-6">
					{outcome.map((set, setIndex) => (
						<div
							key={`${setIndex}:${set.weight}`}
							className="min-w-0"
						>
							{outcome.length > 1 ? (
								<header
									className="mb-3 flex items-center gap-3"
									data-ui="OutcomeSetHeading"
								>
									<h5 className="shrink-0 text-lg font-semibold text-foreground">
										<Tx label="Outcome set" /> {setIndex + 1}
									</h5>
									<span className="min-w-0 flex-1 border-t border-line-strong" />
									<span className="shrink-0 text-lg font-bold tabular-nums text-foreground">
										<Tx label="Weight" /> {set.weight} ·{" "}
										{Number(((set.weight / totalWeight) * 100).toFixed(1))} %
									</span>
								</header>
							) : null}
							{renderSetDetailFn?.(set)}
							{set.activeRuleHints.map((hint, index) => (
								<p
									className="mb-1.5 flex items-start gap-1.5 text-xs text-muted"
									data-ui="TileLineOutcomeSetRuleHint"
									key={`${hint}-${index}`}
								>
									<Info className="mt-px size-3.5 shrink-0 text-secondary-foreground" />
									<span>{hint}</span>
								</p>
							))}
							<div
								className={
									variant === "editor-tree"
										? "flex flex-col gap-3"
										: "flex flex-col gap-1.5"
								}
							>
								{set.roll.map((roll, rollIndex) => (
									<OutcomeRoll
										key={`${roll.kind}:${rollIndex}`}
										roll={roll}
										renderItemDetailFn={renderItemDetailFn}
										renderItemFn={renderItemFn}
										variant={variant}
									/>
								))}
							</div>
						</div>
					))}
				</div>
			)}
		</section>
	);
};
