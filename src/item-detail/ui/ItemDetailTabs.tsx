import { formatForDisplay } from "@tanstack/react-hotkeys";
import { Factory, Info, type LucideIcon } from "lucide-react";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { ItemDetailTabEnumSchema } from "~/item-detail-read/schema/ItemDetailTabEnumSchema";
import type { ItemDetailTarget } from "~/item-detail-frame/type/ItemDetailControl";
import { useItemDetailControl } from "~/item-detail-frame/ui/useItemDetailControl";
import { sectionLinkClassName } from "~/ui/constant/SectionLinkClassName";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { LinkButton } from "~/ui/ui/LinkButton";
import { Tooltip } from "~/ui/ui/Tooltip";
import { useSectionShortcuts } from "~/ui/ui/useSectionShortcuts";

const tabOptions = [
	{
		label: "Info",
		icon: Info,
		shortcut: "i",
		value: "info",
	},
	{
		label: "Lines",
		icon: Factory,
		shortcut: "l",
		value: "lines",
	},
] as const satisfies ReadonlyArray<{
	readonly label: string;
	readonly icon: LucideIcon;
	readonly shortcut: string;
	readonly value: ItemDetailTabEnumSchema.Type;
}>;

interface ItemDetailTabsProps {
	readonly active: ItemDetailTabEnumSchema.Type;
	readonly disabled: boolean;
	readonly retained?: boolean;
	readonly target: ItemDetailTarget;
}

export const ItemDetailTabs = ({
	active,
	disabled,
	retained = false,
	target,
}: ItemDetailTabsProps) => {
	const itemDetail = useItemDetailControl();
	const selectTabFn = (tab: ItemDetailTabEnumSchema.Type) =>
		RendererRuntime.runSync(
			retained
				? itemDetail.selectRetainedItemDetailTabFx({
						kind: target.kind,
						itemId: target.itemId,
						tab,
					})
				: target.kind === "runtime"
					? itemDetail.openItemDetailFx({
							itemId: target.itemId,
							tab,
						})
					: itemDetail.openItemDefinitionDetailFx({
							itemId: target.itemId,
							tab,
						}),
		);
	useSectionShortcuts({
		enabled: !disabled,
		onSelectFn: (option) => selectTabFn(option.value),
		options: tabOptions,
	});
	return (
		<nav
			className="mt-1 flex min-w-0 gap-1 overflow-x-auto overscroll-x-contain"
			data-ui="ItemDetailTabs"
		>
			{tabOptions.map((option) => {
				const tab = option.value;
				const Icon = option.icon;
				return (
					<Tooltip
						key={tab}
						content={`${option.label} · ${formatForDisplay({
							key: option.shortcut,
						})}`}
						placement="bottom"
					>
						<LinkButton
							className={`${sectionLinkClassName} gap-1.5`}
							disabled={disabled}
							data-tab={tab}
							{...readDataUiFn({
								dataUi: "ItemDetailTab",
								state: {
									selected: tab === active,
								},
							})}
							onClick={() => selectTabFn(tab)}
						>
							<Icon className="size-4 shrink-0" />
							{option.label}
						</LinkButton>
					</Tooltip>
				);
			})}
		</nav>
	);
};
