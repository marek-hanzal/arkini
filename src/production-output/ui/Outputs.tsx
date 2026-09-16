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
	renderItemDetailFn,
	renderItemFn,
	variant,
}: {
	readonly item: Item;
	readonly renderItemDetailFn?: (item: Item) => ReactNode;
	readonly renderItemFn: (item: Item) => ReactNode;
	readonly variant: OutputsVariant;
}) => (
	<div
		className={twMerge(
			"grid gap-1.5",
			variant === "editor-tree" && "border-l-2 border-accent pl-24",
		)}
		data-ui="TileLineOutputItem"
	>
		<div className="flex min-w-0 items-center justify-between gap-4 text-sm">
			{renderItemFn(item)}
			<span className="shrink-0 text-muted">
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
	renderItemDetailFn,
	renderItemFn,
	variant,
}: {
	readonly items: readonly Item[];
	readonly renderItemDetailFn?: (item: Item) => ReactNode;
	readonly renderItemFn: (item: Item) => ReactNode;
	readonly variant: OutputsVariant;
}) => (
	<div className={variant === "editor-tree" ? "flex flex-col gap-3" : "space-y-1.5"}>
		{items.map((item) => (
			<OutputItem
				key={item.itemId}
				item={item}
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
	variant,
}: {
	readonly roll: OutputProjection.Roll<Item>;
	readonly renderItemDetailFn?: (item: Item) => ReactNode;
	readonly renderItemFn: (item: Item) => ReactNode;
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
					<p className="text-xs font-medium uppercase tracking-[0.08em] text-muted">
						<Tx label="Guaranteed" />
					</p>
					<OutputItems
						items={guaranteed.item}
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
	title = <Tx label="Outputs" />,
	variant = "compact",
}: {
	readonly emptyLabel?: ReactNode;
	readonly output: readonly OutputProjection.Set<Item>[];
	readonly renderItemDetailFn?: (item: Item) => ReactNode;
	readonly renderItemFn: (item: Item) => ReactNode;
	readonly title?: ReactNode;
	readonly variant?: OutputsVariant;
}) => (
	<section
		className="min-w-0"
		data-ui="Outputs"
		data-variant={variant}
	>
		<h4 className="border-b border-line pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
			{title}
		</h4>
		{output.length === 0 ? (
			<p className="py-3 text-sm text-muted">{emptyLabel}</p>
		) : (
			<div
				className={
					variant === "editor-tree" ? "flex flex-col gap-3" : "divide-y divide-line/60"
				}
			>
				{output.map((set, setIndex) => (
					<div
						key={`${setIndex}:${set.weight}`}
						className="py-1"
					>
						<p className="pt-2 text-xs font-medium text-muted">
							<Tx label="Alternative" /> {setIndex + 1} · <Tx label="Weight" />{" "}
							{set.weight}
						</p>
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
