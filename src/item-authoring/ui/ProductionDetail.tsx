import { Factory } from "lucide-react";

import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { readAuthoredItemLinesFn } from "~/production-line/fn/readAuthoredItemLinesFn";
import { DetailFact, DetailFacts, DetailSection } from "~/item-authoring/ui/DetailDefinition";
import { OutputDetail } from "~/item-authoring/ui/OutputDetail";
import { ProductionLineDetail } from "~/item-authoring/ui/ProductionLineDetail";
import { formatDurationFn } from "~/ui/fn/formatDurationFn";
import { Status } from "~/ui/ui/Status";

/** Dispatches production-capable lines, temporary lifetime, or the disabled contract. */
export const ProductionDetail = ({ item }: { readonly item: ItemSchema.Type }) => {
	const lines = readAuthoredItemLinesFn(item);
	if (item.type === "clock")
		return (
			<div className="grid gap-3">
				<EditorRootCard dataUi="EditorClockScheduleCard">
					<DetailSection title="Clock">
						<DetailFacts>
							<DetailFact
								label="Interval"
								value={formatDurationFn(item.intervalMs)}
							/>
							<DetailFact
								label="Lifetime"
								value={
									item.durationMs === undefined
										? "Unlimited"
										: formatDurationFn(item.durationMs)
								}
							/>
							<DetailFact
								label="Timer"
								value={item.enable ? "Enabled" : "Disabled"}
							/>
							<DetailFact
								label="Rules"
								value={item.rules.length}
							/>
							<DetailFact
								label="Player controls"
								value={
									item.control === "interactive"
										? "Interactive"
										: "Automatic only"
								}
							/>
						</DetailFacts>
					</DetailSection>
				</EditorRootCard>
				<div className="ak-list grid gap-3">
					{lines.map((line) => (
						<ProductionLineDetail
							itemUid={item.uid}
							key={line.id}
							line={line}
						/>
					))}
				</div>
				<EditorRootCard dataUi="EditorClockExpiryOutputCard">
					<OutputDetail
						emptyLabel="No expiry output configured."
						output={item.onExpire}
						title="Expiry output"
					/>
				</EditorRootCard>
			</div>
		);
	if (lines.length > 0)
		return (
			<div className="ak-list grid gap-3">
				{lines.map((line) => (
					<ProductionLineDetail
						itemUid={item.uid}
						key={line.id}
						line={line}
					/>
				))}
			</div>
		);
	if (!("durationMs" in item))
		return (
			<Status
				dataUi="EditorProductionLinesDisabledStatus"
				description="This item has no production lines, so it cannot run production jobs or transform inputs into outputs. Configure a production-capable item to add that behavior."
				icon={Factory}
				title="Production lines are disabled"
			/>
		);
	return (
		<div className="grid gap-3">
			<EditorRootCard dataUi="EditorTemporaryLifetimeCard">
				<DetailSection title="Lifetime">
					<DetailFact
						label="Duration"
						value={formatDurationFn(item.durationMs)}
					/>
				</DetailSection>
			</EditorRootCard>
			<EditorRootCard dataUi="EditorTemporaryExpiryOutputCard">
				<OutputDetail
					emptyLabel="No expiry output configured."
					output={item.output}
					title="Expiry output"
				/>
			</EditorRootCard>
		</div>
	);
};
