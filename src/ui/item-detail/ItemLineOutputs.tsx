import { match } from "ts-pattern";

import type { ItemDetailLines } from "~/bridge/item-detail/ItemDetailLines";
import { ItemReferenceButton } from "~/ui/item-detail/ItemReferenceButton";

const ItemLineOutputItem = ({
	disabled,
	item,
}: {
	readonly disabled: boolean;
	readonly item: ItemDetailLines.OutputItem;
}) => (
	<div
		className="flex min-w-0 items-center justify-between gap-4 text-sm"
		data-ui="TileLineOutputItem"
	>
		{item.sourceUrl === undefined ? (
			<span className="truncate font-medium text-foreground">{item.title}</span>
		) : (
			<ItemReferenceButton
				compositeUrl={item.compositeUrl}
				dataUi="TileLineOutputDetailLink"
				definitionItemId={item.definitionItemId}
				disabled={disabled}
				label={item.title}
				sourceUrl={item.sourceUrl}
			/>
		)}
		<span className="shrink-0 text-muted">
			×
			{item.quantity.min === item.quantity.max
				? item.quantity.min
				: `${item.quantity.min}–${item.quantity.max}`}
		</span>
	</div>
);

const ItemLineOutputItems = ({
	disabled,
	items,
}: {
	readonly disabled: boolean;
	readonly items: readonly ItemDetailLines.OutputItem[];
}) => (
	<div className="space-y-1.5">
		{items.map((item) => (
			<ItemLineOutputItem
				key={item.itemId}
				disabled={disabled}
				item={item}
			/>
		))}
	</div>
);

const ItemLineOutputRoll = ({
	disabled,
	roll,
}: {
	readonly disabled: boolean;
	readonly roll: ItemDetailLines.OutputRoll;
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
					<ItemLineOutputItems
						disabled={disabled}
						items={guaranteed.item}
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
					<ItemLineOutputItems
						disabled={disabled}
						items={chance.item}
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
							<ItemLineOutputItems
								disabled={disabled}
								items={option.item}
							/>
						</div>
					))}
				</div>
			),
		)
		.exhaustive();

/** Renders every authored output alternative and roll for one visible product line. */
export const ItemLineOutputs = ({
	disabled,
	output,
}: {
	readonly disabled: boolean;
	readonly output: readonly ItemDetailLines.OutputSet[];
}) => (
	<section className="min-w-0">
		<h4 className="border-b border-line pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
			Outputs
		</h4>
		{output.length === 0 ? (
			<p className="py-3 text-sm text-muted">Consumes inputs without producing an item.</p>
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
								<ItemLineOutputRoll
									key={`${roll.kind}:${rollIndex}`}
									disabled={disabled}
									roll={roll}
								/>
							))}
						</div>
					</div>
				))}
			</div>
		)}
	</section>
);
