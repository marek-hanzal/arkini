import { formatForDisplay } from "@tanstack/react-hotkeys";

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
		label: "Lines",
		shortcut: "l",
		value: "lines",
	},
	{
		label: "Queue",
		shortcut: "q",
		value: "queue",
	},
	{
		label: "Info",
		shortcut: "i",
		value: "info",
	},
] as const satisfies ReadonlyArray<{
	readonly label: string;
	readonly shortcut: string;
	readonly value: ItemDetailTabEnumSchema.Type;
}>;

const BadgeCount = ({
	count,
	dataUi,
	label,
}: {
	readonly count: number;
	readonly dataUi: string;
	readonly label?: string;
}) => (
	<span
		className="min-w-5 rounded-full bg-warning/20 px-1.5 py-0.5 text-center text-[0.6875rem] font-semibold tabular-nums text-foreground"
		data-ui={dataUi}
	>
		{label === undefined ? count : `${label}${count > 1 ? ` ×${count}` : ""}`}
	</span>
);

interface ItemDetailTabsProps {
	readonly active: ItemDetailTabEnumSchema.Type;
	readonly disabled: boolean;
	readonly lineCount?: number;
	readonly queueCount?: number;
	readonly retained?: boolean;
	readonly target: ItemDetailTarget;
}

export const ItemDetailTabs = ({
	active,
	disabled,
	lineCount,
	queueCount,
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
							{option.label}
							{tab === "lines" && lineCount !== undefined ? (
								<BadgeCount
									count={lineCount}
									dataUi="ItemDetailTabCount"
								/>
							) : null}
							{tab === "queue" && queueCount !== undefined && queueCount > 0 ? (
								<BadgeCount
									count={queueCount}
									dataUi="ItemDetailQueueTabCount"
								/>
							) : null}
						</LinkButton>
					</Tooltip>
				);
			})}
		</nav>
	);
};
