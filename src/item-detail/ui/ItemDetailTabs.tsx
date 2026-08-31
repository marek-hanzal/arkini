import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { ItemDetailTabEnumSchema } from "~/item-detail-read/schema/ItemDetailTabEnumSchema";
import type { ItemDetailTarget } from "~/item-detail-frame/type/ItemDetailControl";
import { useItemDetailControl } from "~/item-detail-frame/ui/useItemDetailControl";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { selectableClassName } from "~/ui/form/SelectableStateClassName";

const tabLabel = {
	info: "Info",
	lines: "Lines",
	queue: "Queue",
	sources: "Sources",
} as const satisfies Record<ItemDetailTabEnumSchema.Type, string>;

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
	readonly stale?: boolean;
	readonly tabs: readonly ItemDetailTabEnumSchema.Type[];
	readonly target: ItemDetailTarget;
}

export const ItemDetailTabs = ({
	active,
	disabled,
	lineCount,
	queueCount,
	stale = false,
	tabs,
	target,
}: ItemDetailTabsProps) => {
	const itemDetail = useItemDetailControl();
	return (
		<nav
			className="flex min-w-0 gap-2 overflow-x-auto py-2"
			data-ui="ItemDetailTabs"
		>
			{tabs.map((tab) => (
				<button
					key={tab}
					type="button"
					className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium disabled:cursor-not-allowed ${selectableClassName}`}
					disabled={disabled}
					data-tab={tab}
					{...readDataUiFn({
						dataUi: "ItemDetailTab",
						state: {
							selected: tab === active,
						},
					})}
					onClick={() =>
						RendererRuntime.runSync(
							target.kind === "runtime"
								? stale
									? itemDetail.selectRetainedItemDetailTabFx({
											itemId: target.itemId,
											tab,
										})
									: itemDetail.openItemDetailFx({
											itemId: target.itemId,
											tab,
										})
								: itemDetail.openItemDefinitionDetailFx({
										itemId: target.itemId,
										tab: tab === "sources" ? tab : "info",
									}),
						)
					}
				>
					{tabLabel[tab]}
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
				</button>
			))}
		</nav>
	);
};
