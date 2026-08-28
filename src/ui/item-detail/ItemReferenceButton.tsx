import { motion } from "motion/react";
import { useState } from "react";

import { RendererRuntime } from "~/renderer/RendererRuntime";
import { ItemIdentity } from "~/ui/item/ItemIdentity";
import { useItemDetailControl } from "~/ui/item-detail/useItemDetailControl";

export interface ItemReferenceButtonProps {
	readonly compositeUrl?: string;
	readonly dataUi:
		| "TileLineInputDetailLink"
		| "TileLineOutputDetailLink"
		| "TileLineUnavailableDependencyLink";
	readonly definitionItemId?: string;
	readonly disabled: boolean;
	readonly label: string;
	readonly runtimeItemId?: string;
	readonly sourceUrl: string;
}

/** Renders one artwork-backed link to a runtime or configured Item Detail target. */
export const ItemReferenceButton = ({
	compositeUrl,
	dataUi,
	definitionItemId,
	disabled,
	label,
	runtimeItemId,
	sourceUrl,
}: ItemReferenceButtonProps) => {
	const itemDetail = useItemDetailControl();
	const [hovered, setHovered] = useState(false);
	const canOpen = !disabled && (runtimeItemId !== undefined || definitionItemId !== undefined);
	return (
		<motion.button
			type="button"
			className="group flex min-w-0 items-center gap-3 text-left outline-none enabled:cursor-pointer disabled:cursor-default"
			disabled={!canOpen}
			data-ui={dataUi}
			data-detail-available={canOpen ? "true" : "false"}
			aria-label={canOpen ? `Open ${label} detail` : undefined}
			animate={{
				scale: hovered && canOpen ? 1.035 : 1,
			}}
			onHoverStart={() => setHovered(true)}
			onHoverEnd={() => setHovered(false)}
			transition={{
				duration: 0.14,
				ease: [
					0.22,
					1,
					0.36,
					1,
				],
			}}
			onClick={() => {
				if (runtimeItemId !== undefined) {
					RendererRuntime.runSync(
						itemDetail.openItemDetailFx({
							itemId: runtimeItemId,
						}),
					);
					return;
				}
				if (definitionItemId !== undefined) {
					RendererRuntime.runSync(
						itemDetail.openItemDefinitionDetailFx({
							itemId: definitionItemId,
						}),
					);
				}
			}}
		>
			<ItemIdentity
				artworkClassName="rounded-lg bg-surface/45 ring-1 ring-line/50 transition-[background-color,box-shadow] group-enabled:group-hover:bg-accent/8 group-enabled:group-hover:ring-accent/35"
				artworkImageClassName="p-0.5"
				compositeUrl={compositeUrl}
				rootTag="span"
				sourceUrl={sourceUrl}
				title={label}
				titleClassName="truncate font-medium text-foreground transition-colors group-enabled:group-hover:text-accent"
			/>
		</motion.button>
	);
};
