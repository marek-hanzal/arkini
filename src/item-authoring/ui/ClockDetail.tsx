import { RulesDetail } from "~/item-authoring/ui/RulesDetail";
import { Clock } from "lucide-react";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { DetailFact, DetailFacts } from "~/item-authoring/ui/DetailDefinition";
import { OutputDetail } from "~/item-authoring/ui/OutputDetail";
import { formatDurationFn } from "~/ui/fn/formatDurationFn";
import { DisabledCapabilityDetail } from "~/item-authoring/ui/DisabledCapabilityDetail";
import { useTranslator } from "~/translation/ui/useTranslator";
import { Mx } from "~/translation/ui/Mx";

/** Presents the authored schedule independently of production lines. */
export const ClockDetail = ({
	item,
	preview = false,
}: {
	readonly item: ItemSchema.Type;
	readonly preview?: boolean;
}) => {
	const translator = useTranslator();
	const clock = item.clock;
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
			empty
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
					{clock.durationMs === undefined ? null : (
						<DetailFact
							label={translator.textFn("Expiry mode")}
							value={translator.textFn(
								clock.expiryMode === "kill-switch" ? "Kill switch" : "Loose-kill",
							)}
							description={
								<Mx
									label={
										clock.expiryMode === "kill-switch"
											? "Authored Clock kill-switch summary help"
											: "Authored Clock loose-kill summary help"
									}
								/>
							}
						/>
					)}
					<DetailFact
						label={translator.textFn("Timer")}
						description={<Mx label="Authored Clock status summary help" />}
						value={translator.textFn(clock.enable ? "Enabled" : "Disabled")}
					/>
				</DetailFacts>
				<RulesDetail rules={clock.rules} />
			</EditorRootCard>
			{clock.durationMs === undefined ? null : (
				<EditorRootCard dataUi="EditorClockExpiryOutputCard">
					<OutputDetail
						emptyLabel={translator.textFn("No expiry output configured.")}
						output={clock.onExpire}
						description={<Mx label="Authored Clock expiry output summary help" />}
						title={translator.textFn("Expiry output")}
					/>
				</EditorRootCard>
			)}
		</div>
	);
};
