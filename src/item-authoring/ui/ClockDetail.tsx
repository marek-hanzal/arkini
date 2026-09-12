import { Clock } from "lucide-react";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { DetailFact, DetailFacts } from "~/item-authoring/ui/DetailDefinition";
import { OutputDetail } from "~/item-authoring/ui/OutputDetail";
import { formatDurationFn } from "~/ui/fn/formatDurationFn";
import { DisabledCapabilityDetail } from "~/item-authoring/ui/DisabledCapabilityDetail";
import { useTranslator } from "~/translation/ui/useTranslator";

/** Presents the authored schedule independently of production lines. */
export const ClockDetail = ({ item }: { readonly item: ItemSchema.Type }) => {
	const translator = useTranslator();
	const clock = item.clock;
	if (clock === undefined)
		return (
			<EditorRootCard dataUi="EditorClockDisabledCard">
				<DisabledCapabilityDetail
					capability="clock"
					itemUid={item.uid}
					actionLabel={translator.textFn("Enable clock")}
					icon={Clock}
					title={translator.textFn("Clock is disabled")}
					description={translator.textFn(
						"A clock can run at intervals or expire once. Enabling it removes the action and fixes this item to the board with a stack size of one.",
					)}
				/>
			</EditorRootCard>
		);
	return (
		<div className="grid gap-3">
			<EditorRootCard dataUi="EditorClockScheduleCard">
				<DetailFacts>
					<DetailFact
						label={translator.textFn("Interval")}
						value={
							clock.intervalMs === undefined
								? translator.textFn("None")
								: formatDurationFn(clock.intervalMs)
						}
					/>
					<DetailFact
						label={translator.textFn("Lifetime")}
						value={
							clock.durationMs === undefined
								? translator.textFn("Unlimited")
								: formatDurationFn(clock.durationMs)
						}
					/>
					<DetailFact
						label={translator.textFn("Timer")}
						value={translator.textFn(clock.enable ? "Enabled" : "Disabled")}
					/>
					<DetailFact
						label={translator.textFn("Rules")}
						value={clock.rules.length}
					/>
				</DetailFacts>
			</EditorRootCard>
			{clock.durationMs === undefined ? null : (
				<EditorRootCard dataUi="EditorClockExpiryOutputCard">
					<OutputDetail
						emptyLabel={translator.textFn("No expiry output configured.")}
						output={clock.onExpire}
						title={translator.textFn("Expiry output")}
					/>
				</EditorRootCard>
			)}
		</div>
	);
};
