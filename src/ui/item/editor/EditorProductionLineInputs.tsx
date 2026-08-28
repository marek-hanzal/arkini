import type { InputSchema as LineInputSchema } from "~/engine/input/schema/InputSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { QuantitySchema } from "~/engine/quantity/schema/QuantitySchema";
import type { SelectorSchema } from "~/engine/selector/schema/SelectorSchema";
import { EditorItemDetailReference } from "~/ui/item/editor/EditorItemDetailReference";

type EditorItemRegistry = Record<string, ItemSchema.Type>;

const formatQuantity = (quantity: QuantitySchema.Type) =>
	quantity.min === quantity.max ? String(quantity.min) : quantity.min + "–" + quantity.max;

const formatChargeCost = (input: LineInputSchema.Type) => {
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

const EditorLineInputReference = ({
	items,
	projectId,
	selector,
}: {
	readonly items: EditorItemRegistry;
	readonly projectId: string;
	readonly selector: SelectorSchema.Type;
}) => {
	const item = items[selector.itemId];
	return item === undefined ? (
		<p className="truncate font-medium text-foreground">{selector.itemId}</p>
	) : (
		<EditorItemDetailReference
			item={item}
			projectId={projectId}
		/>
	);
};

const EditorLineInput = ({
	input,
	items,
	projectId,
}: {
	readonly input: LineInputSchema.Type;
	readonly items: EditorItemRegistry;
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
				<EditorLineInputReference
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
					{formatChargeCost(input)}
				</p>
			</div>
			<p className="text-right font-medium text-foreground">
				{input.type === "materials"
					? "×" + formatQuantity(input.quantity) + " required"
					: "Required"}
			</p>
		</div>
	);
};

/** Presents every visible material, board, and charge requirement for one production line. */
export const EditorProductionLineInputs = ({
	emptyLabel = "No material input required.",
	input,
	items,
	projectId,
	title = "Inputs",
}: {
	readonly emptyLabel?: string;
	readonly input: readonly LineInputSchema.Type[];
	readonly items: EditorItemRegistry;
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
						<EditorLineInput
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
