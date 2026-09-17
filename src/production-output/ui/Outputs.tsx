import { Tx } from "~/translation/ui/Tx";
import { Info } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { match } from "ts-pattern";
import type { ReactNode } from "react";

import type { OutputProjection } from "~/production-output/type/OutputProjection";
import { QuantityValue } from "~/item-definition/ui/QuantityValue";

type OutputsVariant = "compact" | "editor-tree";

const OutputItem = <Item extends OutputProjection.Item>({
	item,
	eyebrow,
	renderItemDetailFn,
	renderItemFn,
	variant,
}: {
	readonly item: Item;
	readonly renderItemDetailFn?: (item: Item) => ReactNode;
	readonly renderItemFn: (item: Item, eyebrow?: ReactNode) => ReactNode;
	readonly variant: OutputsVariant;
	readonly eyebrow?: ReactNode;
}) => (
	<div
		className={twMerge(
			"grid gap-1.5",
			variant === "editor-tree" && "border-l-2 border-accent",
			variant === "editor-tree" && eyebrow === undefined && "pl-24",
		)}
		data-ui="TileLineOutputItem"
	>
		<div className="flex min-w-0 items-center justify-between gap-4 text-sm">
			{renderItemFn(item, eyebrow)}
			<span className="shrink-0 text-lg font-bold tabular-nums text-foreground">
				×<QuantityValue quantity={item.quantity} />
			</span>
		</div>
		{item.activeRuleHints.map((hint, index) => (
			<p
				className="flex items-start gap-1.5 text-xs text-muted"
				data-ui="TileLineOutputRuleHint"
				key={`${hint}-${index}`}
			>
				<Info className="mt-px size-3.5 shrink-0 text-secondary-foreground" />
				<span>{hint}</span>
			</p>
		))}
		{renderItemDetailFn?.(item)}
	</div>
);

const OutputItems = <Item extends OutputProjection.Item>({
	items,
	eyebrow,
	renderItemDetailFn,
	renderItemFn,
	variant,
}: {
	readonly items: readonly Item[];
	readonly renderItemDetailFn?: (item: Item) => ReactNode;
	readonly renderItemFn: (item: Item, eyebrow?: ReactNode) => ReactNode;
	readonly variant: OutputsVariant;
	readonly eyebrow?: ReactNode;
}) => (
	<div className={variant === "editor-tree" ? "flex flex-col gap-3" : "space-y-1.5"}>
		{items.map((item) => (
			<OutputItem
				key={item.itemId}
				item={item}
				eyebrow={eyebrow}
				renderItemDetailFn={renderItemDetailFn}
				renderItemFn={renderItemFn}
				variant={variant}
			/>
		))}
	</div>
);

const OutputRoll = <Item extends OutputProjection.Item>({
	roll,
	renderItemDetailFn,
	renderItemFn,
	renderWeightedOptionDetailFn,
	variant,
}: {
	readonly roll: OutputProjection.Roll<Item>;
	readonly renderItemDetailFn?: (item: Item) => ReactNode;
	readonly renderItemFn: (item: Item, eyebrow?: ReactNode) => ReactNode;
	readonly renderWeightedOptionDetailFn?: (
		option: OutputProjection.WeightedOption<Item>,
	) => ReactNode;
	readonly variant: OutputsVariant;
}) =>
	match(roll)
		.with(
			{
				kind: "guaranteed",
			},
			(guaranteed) => (
				<div
					className="grid gap-2 py-2"
					data-ui="TileLineOutputRoll"
					data-roll-kind="guaranteed"
				>
					<OutputItems
						items={guaranteed.item}
						eyebrow={
							<span className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-muted">
								<Tx label="Guaranteed" />
							</span>
						}
						renderItemDetailFn={renderItemDetailFn}
						renderItemFn={renderItemFn}
						variant={variant}
					/>
				</div>
			),
		)
		.with(
			{
				kind: "chance",
			},
			(chance) => (
				<div
					className="grid gap-2 py-2"
					data-ui="TileLineOutputRoll"
					data-roll-kind="chance"
				>
					<p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">
						{Math.round(chance.chance * 100)}% <Tx label="chance" />
					</p>
					<OutputItems
						items={chance.item}
						renderItemDetailFn={renderItemDetailFn}
						renderItemFn={renderItemFn}
						variant={variant}
					/>
				</div>
			),
		)
		.with(
			{
				kind: "weight",
			},
			(weight) => (
				<div
					className="grid gap-3 py-2"
					data-ui="TileLineOutputRoll"
					data-roll-kind="weight"
				>
					<p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">
						<QuantityValue quantity={weight.selections} />{" "}
						<Tx label="Weighted selections" />
					</p>
					{weight.option.map((option, index) => (
						<div
							key={`${index}:${option.weight}`}
							className={twMerge(
								"border-l border-line pl-3",
								variant === "editor-tree" && "border-0 pl-0",
							)}
						>
							<p className="mb-1.5 text-xs text-muted">
								<Tx label="Weight" /> {option.weight}
							</p>
							{renderWeightedOptionDetailFn?.(option)}
							{option.activeRuleHints.map((hint, hintIndex) => (
								<p
									className="mb-1.5 flex items-start gap-1.5 text-xs text-muted"
									data-ui="TileLineOutputCandidateRuleHint"
									key={`${hint}-${hintIndex}`}
								>
									<Info className="mt-px size-3.5 shrink-0 text-secondary-foreground" />
									<span>{hint}</span>
								</p>
							))}
							<OutputItems
								items={option.item}
								renderItemDetailFn={renderItemDetailFn}
								renderItemFn={renderItemFn}
								variant={variant}
							/>
						</div>
					))}
				</div>
			),
		)
		.exhaustive();

/** Renders every authored output alternative and roll for one visible product line. */
export const Outputs = <Item extends OutputProjection.Item>({
	emptyLabel = <Tx label="No output" />,
	output,
	renderItemDetailFn,
	renderItemFn,
	renderWeightedOptionDetailFn,
	title = <Tx label="Outputs" />,
	variant = "compact",
}: {
	readonly emptyLabel?: ReactNode;
	readonly output: readonly OutputProjection.Set<Item>[];
	readonly renderItemDetailFn?: (item: Item) => ReactNode;
	readonly renderItemFn: (item: Item, eyebrow?: ReactNode) => ReactNode;
	readonly renderWeightedOptionDetailFn?: (
		option: OutputProjection.WeightedOption<Item>,
	) => ReactNode;
	readonly title?: ReactNode;
	readonly variant?: OutputsVariant;
}) => (
	<section
		className="min-w-0"
		data-ui="Outputs"
		data-variant={variant}
	>
		<h4 className="pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
			{title}
		</h4>
		{output.length === 0 ? (
			<p className="py-3 text-sm text-muted">{emptyLabel}</p>
		) : (
			<div className="flex flex-col gap-6 pt-4">
				{output.map((set, setIndex) => (
					<div
						key={`${setIndex}:${set.weight}`}
						className="py-1"
					>
						<header
							className="mb-3 flex items-center gap-3"
							data-ui="OutputSetHeading"
						>
							<h5 className="shrink-0 text-lg font-semibold text-foreground">
								<Tx label="Output set" /> {setIndex + 1}
							</h5>
							<span className="min-w-0 flex-1 border-t border-line-strong" />
							<span className="shrink-0 text-lg font-bold tabular-nums text-foreground">
								<Tx label="Weight" /> {set.weight}
							</span>
						</header>
						<div
							className={
								variant === "editor-tree"
									? "flex flex-col gap-3"
									: "divide-y divide-line/60"
							}
						>
							{set.roll.map((roll, rollIndex) => (
								<OutputRoll
									key={`${roll.kind}:${rollIndex}`}
									roll={roll}
									renderItemDetailFn={renderItemDetailFn}
									renderItemFn={renderItemFn}
									renderWeightedOptionDetailFn={renderWeightedOptionDetailFn}
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
