import { useTranslator } from "~/translation/ui/useTranslator";
import { AnimatePresence, motion } from "motion/react";

import { itemDetailFadeMotion } from "~/item-detail-frame/ui/ItemDetailMotion";
import type { ItemDetailLinesProjection } from "~/item-line-detail/type/ItemDetailLinesProjection";
import { ItemLineInputFrame, ItemLineInputTitle } from "~/item-line-detail/ui/ItemLineInputFrame";
import { BoardDistancePresentation } from "~/item-query/ui/QueryPresentation";
import { UnitCostValue } from "~/production-input/ui/UnitCostValue";

type UnitsInput = Extract<
	ItemDetailLinesProjection.Input,
	{
		readonly kind: "units";
	}
>;

/** Owns unit availability on the Board and the cost presentation. */
export const UnitsItemLineInput = ({
	disabled,
	input,
	stale,
	suppressSurface,
}: {
	readonly disabled: boolean;
	readonly input: UnitsInput;
	readonly stale: boolean;
	readonly suppressSurface: boolean;
}) => {
	const translator = useTranslator();
	return (
		<ItemLineInputFrame
			inputKind="units"
			state={input.availableUnits > 0 ? "available" : "empty"}
			suppressSurface={suppressSurface}
		>
			<div className="min-w-0">
				<ItemLineInputTitle
					detail={input.detail}
					disabled={disabled}
					label={input.selector.label}
				/>
				<p className="mt-0.5 text-xs text-muted">
					{translator.textFn("Board")} ·{" "}
					{translator.textFn(BoardDistancePresentation[input.distance].label)}
					{input.units === undefined ? null : (
						<>
							{" · "}
							<UnitCostValue unit={input.units} />
						</>
					)}
				</p>
			</div>
			{stale ? null : (
				<div className="text-right">
					<AnimatePresence
						initial={false}
						mode="popLayout"
					>
						<motion.p
							key={input.availableUnitsLabel}
							className="font-medium text-foreground"
							{...itemDetailFadeMotion}
						>
							{input.availableUnitsLabel === "None"
								? translator.textFn("None available")
								: `${input.availableUnitsLabel} ${input.availableUnits === 1 ? translator.textFn("unit available") : translator.textFn("units available")}`}
						</motion.p>
					</AnimatePresence>
				</div>
			)}
		</ItemLineInputFrame>
	);
};
