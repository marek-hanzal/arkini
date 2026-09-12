import { Clock } from "lucide-react";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { DetailFact, DetailFacts, DetailSection } from "~/item-authoring/ui/DetailDefinition";
import { OutputDetail } from "~/item-authoring/ui/OutputDetail";
import { formatDurationFn } from "~/ui/fn/formatDurationFn";
import { Status } from "~/ui/ui/Status";
import { useTranslator } from "~/translation/ui/useTranslator";

/** Presents the authored schedule independently of production lines. */
export const ClockDetail = ({ item }: { readonly item: ItemSchema.Type }) => {
	const translator = useTranslator();
	const clock = item.clock;
	if (clock === undefined)
		return (
			<Status
				dataUi="EditorClockDisabledStatus"
				icon={Clock}
				title={translator.textFn("Clock is disabled")}
				description={translator.textFn(
					"Enable a clock for periodic production or a one-time lifetime.",
				)}
			/>
		);
	return (
		<div className="grid gap-3">
			<EditorRootCard dataUi="EditorClockScheduleCard">
				<DetailSection title={translator.textFn("Clock")}>
					<DetailFacts>
						<DetailFact
							label={translator.textFn(
								clock.intervalMs === undefined ? "Clock mode" : "Interval",
							)}
							value={
								clock.intervalMs === undefined
									? translator.textFn("Once")
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
				</DetailSection>
			</EditorRootCard>
			<EditorRootCard dataUi="EditorClockExpiryOutputCard">
				<OutputDetail
					emptyLabel={translator.textFn("No expiry output configured.")}
					output={clock.onExpire}
					title={translator.textFn("Expiry output")}
				/>
			</EditorRootCard>
		</div>
	);
};
