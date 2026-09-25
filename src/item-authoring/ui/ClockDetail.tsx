import { RulesDetail } from "~/item-authoring/ui/RulesDetail";
import { Clock } from "lucide-react";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { DetailFact, DetailFacts } from "~/item-authoring/ui/DetailDefinition";
import { formatDurationFn } from "~/ui/fn/formatDurationFn";
import { DisabledCapabilityDetail } from "~/item-authoring/ui/DisabledCapabilityDetail";
import { useTranslator } from "~/translation/ui/useTranslator";
import { Mx } from "~/translation/ui/Mx";
import { ProductionDetail } from "~/item-authoring/ui/ProductionDetail";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { LineTriggerEnumSchema } from "~/production-line/schema/LineTriggerEnumSchema";

/** Presents the authored schedule and its Clock-owned production lines. */
export const ClockDetail = ({
	item,
	preview = false,
}: {
	readonly item: ItemSchema.Type;
	readonly preview?: boolean;
}) => {
	const translator = useTranslator();
	const clock = item.clock;
	const production =
		!preview &&
		item.lines.some((line) => line.trigger === LineTriggerEnumSchema.enum["clock-interval"]) ? (
			<div className="grid gap-3">
				<EditorFormSectionDivider title={translator.textFn("Production")} />
				<ProductionDetail
					item={item}
					kind="clock"
				/>
			</div>
		) : null;
	if (clock === undefined) {
		const empty = (
			<DisabledCapabilityDetail
				capability="clock"
				itemUid={item.uid}
				actionLabel={translator.textFn("Enable")}
				icon={Clock}
				title={translator.textFn(
					preview ? "Item clock empty title" : "No Clock configured",
				)}
				summary={preview ? undefined : translator.textFn("Item clock empty title")}
				size={preview ? "normal" : "large"}
			/>
		);
		return preview ? (
			<EditorRootCard dataUi="EditorClockDisabledCard">{empty}</EditorRootCard>
		) : (
			<div className="grid gap-3">
				{empty}
				{production}
			</div>
		);
	}

	return (
		<div className="grid gap-3">
			<EditorRootCard dataUi="EditorClockScheduleCard">
				<DetailFacts>
					<DetailFact
						label={translator.textFn("Lifetime")}
						description={<Mx label="Authored Clock lifetime summary help" />}
						value={
							clock.durationMs === undefined
								? translator.textFn("Unlimited")
								: formatDurationFn(clock.durationMs)
						}
					/>
					<DetailFact
						label={translator.textFn("Interval")}
						description={<Mx label="Authored Clock interval summary help" />}
						value={
							clock.intervalMs === undefined
								? translator.textFn("None")
								: formatDurationFn(clock.intervalMs)
						}
					/>
					<DetailFact
						label={translator.textFn("Timer")}
						description={<Mx label="Authored Clock status summary help" />}
						value={translator.textFn(clock.enable ? "Enabled" : "Disabled")}
					/>
				</DetailFacts>
				<RulesDetail rules={clock.rules} />
			</EditorRootCard>
			{production}
		</div>
	);
};
