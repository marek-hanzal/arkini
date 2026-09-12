import { useTranslator } from "~/translation/ui/useTranslator";
import type { InputSchema as LineInputSchema } from "~/production-input/schema/InputSchema";
import { QuantityValue } from "~/item-definition/ui/QuantityValue";
import { QueryDetail } from "~/item-authoring/ui/QueryDetail";
import { SelectorDetail } from "~/item-authoring/ui/SelectorDetail";
import { UnitCostValue } from "~/production-input/ui/UnitCostValue";

const LineInput = ({ input }: { readonly input: LineInputSchema.Type }) => {
	const translator = useTranslator();
	const rowClassName =
		"ak-line-input grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 rounded-xl bg-transparent px-3 py-2 text-sm";
	if (input.type === "simple")
		return input.units === undefined ? null : (
			<div className={rowClassName}>
				<p className="font-medium text-foreground">{translator.textFn("Owner units")}</p>
				<p className="text-right text-sm text-muted">
					<UnitCostValue unit={input.units} />
				</p>
			</div>
		);
	return (
		<div className={rowClassName}>
			<div className="min-w-0">
				{input.type === "materials" ? (
					<SelectorDetail selector={input.selector} />
				) : (
					<QueryDetail query={input.query} />
				)}
				<p className="mt-0.5 text-xs text-muted">
					{input.type === "materials"
						? input.mode === "consume"
							? "Consumed"
							: "Reserved"
						: translator.textFn("Required units")}
					{input.units === undefined ? null : (
						<>
							{" · "}
							<UnitCostValue unit={input.units} />
						</>
					)}
				</p>
			</div>
			<p className="text-right font-medium text-foreground">
				{input.type === "materials" ? (
					<>
						×<QuantityValue quantity={input.quantity} /> required
					</>
				) : (
					"Required"
				)}
			</p>
		</div>
	);
};

/** Presents every visible material, board, and unit requirement for one production line. */
export const ProductionLineInputs = ({
	emptyLabel = "No material input required.",
	input,
	title = "Inputs",
}: {
	readonly emptyLabel?: string;
	readonly input: readonly LineInputSchema.Type[];
	readonly title?: string;
}) => {
	const visibleInput = input.filter(
		(entry) => entry.type !== "simple" || entry.units !== undefined,
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
							key={entry.type + ":" + index}
						/>
					))}
				</div>
			)}
		</section>
	);
};
