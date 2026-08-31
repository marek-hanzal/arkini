import type { InputSchema as LineInputSchema } from "~/production-input/schema/InputSchema";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { QuantitySchema } from "~/item-definition/schema/QuantitySchema";
import type { SelectorSchema } from "~/item-definition/schema/SelectorSchema";
import { DetailReference } from "~/item-authoring/ui/DetailReference";

type ItemRegistry = Record<string, ItemSchema.Type>;

const formatQuantityFn = (quantity: QuantitySchema.Type) =>
	quantity.min === quantity.max ? String(quantity.min) : quantity.min + "–" + quantity.max;

const formatChargeCostFn = (input: LineInputSchema.Type) => {
	if (input.charges === undefined) return "";
	return (
		" · " +
		input.charges.cost +
		" charge" +
		(input.charges.cost === 1 ? "" : "s") +
		" from " +
		(input.charges.from === "self" ? "owner" : "target")
	);
};

const LineInputReference = ({
	items,
	projectId,
	selector,
}: {
	readonly items: ItemRegistry;
	readonly projectId: string;
	readonly selector: SelectorSchema.Type;
}) => {
	const item = items[selector.itemId];
	return item === undefined ? (
		<p className="truncate font-medium text-foreground">{selector.itemId}</p>
	) : (
		<DetailReference
			item={item}
			projectId={projectId}
		/>
	);
};

const LineInput = ({
	input,
	items,
	projectId,
}: {
	readonly input: LineInputSchema.Type;
	readonly items: ItemRegistry;
	readonly projectId: string;
}) => {
	const rowClassName =
		"ak-line-input grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 rounded-xl bg-transparent px-3 py-2 text-sm";
	if (input.type === "simple")
		return input.charges === undefined ? null : (
			<div className={rowClassName}>
				<p className="font-medium text-foreground">Owner charge</p>
				<p className="text-right text-sm text-muted">
					{input.charges.cost} charge{input.charges.cost === 1 ? "" : "s"} from{" "}
					{input.charges.from === "self" ? "owner" : "target"}
				</p>
			</div>
		);
	const selector = input.type === "materials" ? input.selector : input.query.selector;
	return (
		<div className={rowClassName}>
			<div className="min-w-0">
				<LineInputReference
					items={items}
					projectId={projectId}
					selector={selector}
				/>
				<p className="mt-0.5 text-xs text-muted">
					{input.type === "materials"
						? input.mode === "consume"
							? "Consumed"
							: "Reserved"
						: "Board · " + input.query.distance}
					{formatChargeCostFn(input)}
				</p>
			</div>
			<p className="text-right font-medium text-foreground">
				{input.type === "materials"
					? "×" + formatQuantityFn(input.quantity) + " required"
					: "Required"}
			</p>
		</div>
	);
};

/** Presents every visible material, board, and charge requirement for one production line. */
export const ProductionLineInputs = ({
	emptyLabel = "No material input required.",
	input,
	items,
	projectId,
	title = "Inputs",
}: {
	readonly emptyLabel?: string;
	readonly input: readonly LineInputSchema.Type[];
	readonly items: ItemRegistry;
	readonly projectId: string;
	readonly title?: string;
}) => {
	const visibleInput = input.filter(
		(entry) => entry.type !== "simple" || entry.charges !== undefined,
	);
	return (
		<section className="min-w-0">
			<h4 className="border-b border-line pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
				{title}
			</h4>
			{visibleInput.length === 0 ? (
				<p className="py-3 text-sm text-muted">{emptyLabel}</p>
			) : (
				<div className="space-y-1 pt-2">
					{visibleInput.map((entry, index) => (
						<LineInput
							input={entry}
							items={items}
							key={entry.type + ":" + index}
							projectId={projectId}
						/>
					))}
				</div>
			)}
		</section>
	);
};
