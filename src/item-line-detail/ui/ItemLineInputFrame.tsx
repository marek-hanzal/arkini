import { motion } from "motion/react";
import type { ReactNode } from "react";

import type { ItemDetailReference } from "~/item-detail-frame/fx/projectItemDetailReferenceFx";
import { itemDetailFadeMotion } from "~/item-detail-frame/ui/ItemDetailMotion";
import { ItemReferenceButton } from "~/item-detail-frame/ui/ItemReferenceButton";
import type { ItemDetailLinesProjection } from "~/item-line-detail/type/ItemDetailLinesProjection";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";

export type ItemLineInputState = "available" | "delivery" | "empty" | "stored";

/** Owns the visual-state projection shared by every line-input grammar. */
export const ItemLineInputFrame = ({
	children,
	inputKind,
	state,
	suppressSurface,
}: {
	readonly children: ReactNode;
	readonly inputKind: ItemDetailLinesProjection.Input["kind"];
	readonly state: ItemLineInputState;
	readonly suppressSurface: boolean;
}) => (
	<motion.div
		layout
		className="ak-line-input grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 rounded-xl px-3 py-2 text-sm"
		{...readDataUiFn({
			dataUi: "TileLineInput",
			state: {
				inputKind,
				inputState: state,
				surfaceSuppressed: suppressSurface,
			},
		})}
		{...itemDetailFadeMotion}
	>
		{children}
	</motion.div>
);

/** Renders the shared plain or navigable identity of a projected line input. */
export const ItemLineInputTitle = ({
	detail,
	disabled,
	label,
}: {
	readonly detail?: ItemDetailReference;
	readonly disabled: boolean;
	readonly label: string;
}) =>
	detail === undefined ? (
		<p className="truncate font-medium text-foreground">{label}</p>
	) : (
		<ItemReferenceButton
			compositeUrl={detail.compositeUrl}
			dataUi="TileLineInputDetailLink"
			definitionItemId={detail.itemId}
			disabled={disabled}
			label={label}
			runtimeItemId={detail.detailItemId}
			sourceUrl={detail.sourceUrl}
		/>
	);
