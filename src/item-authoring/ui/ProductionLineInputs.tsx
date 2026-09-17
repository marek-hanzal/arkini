import { Tx } from "~/translation/ui/Tx";
import { useTranslator } from "~/translation/ui/useTranslator";
import type { InputSchema as LineInputSchema } from "~/production-input/schema/InputSchema";
import { QuantityValue } from "~/item-definition/ui/QuantityValue";
import { QueryDetail } from "~/item-authoring/ui/QueryDetail";
import { SelectorDetail } from "~/item-authoring/ui/SelectorDetail";
import { UnitCostValue } from "~/production-input/ui/UnitCostValue";

const LineInput = ({ input }: { readonly input: LineInputSchema.Type }) => {
	const translator = useTranslator();
	const rowClassName =
		"flex min-w-0 items-center justify-between gap-4 border-l-2 border-accent text-sm";
	if (input.type === "simple")
		return input.units === undefined ? null : (
			<div
				className={rowClassName}
				data-ui="EditorProductionLineInput"
			>
				<p className="font-medium text-foreground">{translator.textFn("Owner units")}</p>
				<p className="shrink-0 text-right text-lg font-bold tabular-nums text-foreground">
					<UnitCostValue unit={input.units} />
				</p>
			</div>
		);
	const eyebrow = (
		<span className="mb-1 block text-xs font-medium uppercase tracking-[0.08em] text-muted">
			{input.type === "materials"
				? input.mode === "consume"
					? translator.textFn("Consumed")
					: translator.textFn("Reserved")
				: translator.textFn("Required units")}
		</span>
	);
	const description =
		input.units === undefined ? undefined : (
			<span className="block text-xs text-muted">
				<UnitCostValue unit={input.units} />
			</span>
		);
	return (
		<div
			className={rowClassName}
			data-ui="EditorProductionLineInput"
		>
			{input.type === "materials" ? (
				<SelectorDetail
					selector={input.selector}
					eyebrow={eyebrow}
					description={description}
				/>
			) : (
				<QueryDetail
					query={input.query}
					eyebrow={eyebrow}
					description={description}
				/>
			)}
			<p className="shrink-0 text-right text-lg font-bold tabular-nums text-foreground">
				{input.type === "materials" ? (
					<>
						×<QuantityValue quantity={input.quantity} /> <Tx label="Required" />
					</>
				) : (
					<Tx label="Required" />
				)}
			</p>
		</div>
	);
};

/** Presents every visible material, board, and unit requirement for one production line. */
export const ProductionLineInputs = ({
	emptyLabel,
	input,
}: {
	readonly emptyLabel?: string;
	readonly input: readonly LineInputSchema.Type[];
}) => {
	const translator = useTranslator();
	const visibleInput = input.filter(
		(entry) => entry.type !== "simple" || entry.units !== undefined,
	);
	return (
		<section
			className="min-w-0"
			data-ui="EditorProductionLineInputs"
		>
			{visibleInput.length === 0 ? (
				<p className="py-3 text-sm text-muted">
					{emptyLabel ?? translator.textFn("No inputs")}
				</p>
			) : (
				<div className="flex flex-col gap-3">
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
