import type { ReactNode } from "react";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { ItemIdentity } from "~/ui/ui/ItemIdentity";
import { useItemDetailControl } from "~/item-detail-frame/ui/useItemDetailControl";

interface ItemReferenceButtonProps {
	readonly compositeUrl?: string;
	readonly dataUi:
		| "TileLineInputDetailLink"
		| "TileLineOutputDetailLink"
		| "TileLineUnavailableDependencyLink";
	readonly definitionItemId?: string;
	readonly description?: ReactNode;
	readonly eyebrow?: ReactNode;
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
	description,
	eyebrow,
	disabled,
	label,
	runtimeItemId,
	sourceUrl,
}: ItemReferenceButtonProps) => {
	const itemDetail = useItemDetailControl();
	const canOpen = !disabled && (runtimeItemId !== undefined || definitionItemId !== undefined);
	return (
		<button
			type="button"
			className="group flex min-w-0 items-center gap-3 text-left outline-none enabled:cursor-pointer disabled:cursor-default"
			disabled={!canOpen}
			data-ui={dataUi}
			data-detail-available={canOpen ? "true" : "false"}
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
				description={description}
				eyebrow={
					eyebrow === undefined ? undefined : (
						<span className="block [&>span]:transition-colors group-enabled:group-hover:[&>span]:text-accent">
							{eyebrow}
						</span>
					)
				}
				rootTag="span"
				sourceUrl={sourceUrl}
				title={label}
				titleClassName="truncate font-medium text-foreground transition-colors group-enabled:group-hover:text-accent"
			/>
		</button>
	);
};
