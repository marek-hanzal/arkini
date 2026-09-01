import { Info } from "lucide-react";
import { match } from "ts-pattern";
import type { ReactNode } from "react";

import type { OutputProjection } from "~/production-output/type/OutputProjection";

const OutputItem = <Item extends OutputProjection.Item>({
	item,
	renderItemDetailFn,
	renderItemFn,
}: {
	readonly item: Item;
	readonly renderItemDetailFn?: (item: Item) => ReactNode;
	readonly renderItemFn: (item: Item) => ReactNode;
}) => (
	<div
		className="grid gap-1.5"
		data-ui="TileLineOutputItem"
	>
		<div className="flex min-w-0 items-center justify-between gap-4 text-sm">
			{renderItemFn(item)}
			<span className="shrink-0 text-muted">
				×
				{item.quantity.min === item.quantity.max
					? item.quantity.min
					: `${item.quantity.min}–${item.quantity.max}`}
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
}: {
	readonly items: readonly Item[];
	readonly renderItemDetailFn?: (item: Item) => ReactNode;
	readonly renderItemFn: (item: Item) => ReactNode;
}) => (
	<div className="space-y-1.5">
		{items.map((item) => (
			<OutputItem
				key={item.itemId}
				item={item}
				renderItemDetailFn={renderItemDetailFn}
				renderItemFn={renderItemFn}
			/>
		))}
	</div>
);

const OutputRoll = <Item extends OutputProjection.Item>({
	roll,
	renderItemDetailFn,
	renderItemFn,
}: {
	readonly roll: OutputProjection.Roll<Item>;
	readonly renderItemDetailFn?: (item: Item) => ReactNode;
	readonly renderItemFn: (item: Item) => ReactNode;
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
						Guaranteed
					</p>
					<OutputItems
						items={guaranteed.item}
						renderItemDetailFn={renderItemDetailFn}
						renderItemFn={renderItemFn}
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
						{Math.round(chance.chance * 100)}% chance
					</p>
					<OutputItems
						items={chance.item}
						renderItemDetailFn={renderItemDetailFn}
						renderItemFn={renderItemFn}
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
						{weight.selections.min === weight.selections.max
							? weight.selections.min
							: `${weight.selections.min}–${weight.selections.max}`}{" "}
						weighted selection{weight.selections.max === 1 ? "" : "s"}
					</p>
					{weight.option.map((option, index) => (
						<div
							key={`${index}:${option.weight}`}
							className="border-l border-line pl-3"
						>
							<p className="mb-1.5 text-xs text-muted">Weight {option.weight}</p>
							<OutputItems
								items={option.item}
								renderItemDetailFn={renderItemDetailFn}
								renderItemFn={renderItemFn}
							/>
						</div>
					))}
				</div>
			),
		)
		.exhaustive();

/** Renders every authored output alternative and roll for one visible product line. */
export const Outputs = <Item extends OutputProjection.Item>({
	emptyLabel = "Consumes inputs without producing an item.",
	output,
	renderItemDetailFn,
	renderItemFn,
	title = "Outputs",
}: {
	readonly emptyLabel?: string;
	readonly output: readonly OutputProjection.Set<Item>[];
	readonly renderItemDetailFn?: (item: Item) => ReactNode;
	readonly renderItemFn: (item: Item) => ReactNode;
	readonly title?: string;
}) => (
	<section className="min-w-0">
		<h4 className="border-b border-line pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
			{title}
		</h4>
		{output.length === 0 ? (
			<p className="py-3 text-sm text-muted">{emptyLabel}</p>
		) : (
			<div className="divide-y divide-line/60">
				{output.map((set, setIndex) => (
					<div
						key={`${setIndex}:${set.weight}`}
						className="py-1"
					>
						{output.length > 1 ? (
							<p className="pt-2 text-xs font-medium text-muted">
								Alternative {setIndex + 1} · weight {set.weight}
							</p>
						) : null}
						<div className="divide-y divide-line/60">
							{set.roll.map((roll, rollIndex) => (
								<OutputRoll
									key={`${roll.kind}:${rollIndex}`}
									roll={roll}
									renderItemDetailFn={renderItemDetailFn}
									renderItemFn={renderItemFn}
								/>
							))}
						</div>
					</div>
				))}
			</div>
		)}
	</section>
);
