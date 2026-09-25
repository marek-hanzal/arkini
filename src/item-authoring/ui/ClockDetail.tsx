import { RulesDetail } from "~/item-authoring/ui/RulesDetail";
import { Clock } from "lucide-react";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { EditorRootCard } from "~/authoring-shell/ui/EditorRootCard";
import { DetailFact, DetailFacts } from "~/item-authoring/ui/DetailDefinition";
import { formatDurationFn } from "~/ui/fn/formatDurationFn";
import { DisabledCapabilityDetail } from "~/item-authoring/ui/DisabledCapabilityDetail";
import { useTranslator } from "~/translation/ui/useTranslator";
import { Mx } from "~/translation/ui/Mx";

/** Presents authored Clock timing and rules. */
export const ClockDetail = ({ item }: { readonly item: ItemSchema.Type }) => {
	const translator = useTranslator();
	const clock = item.clock;
	if (clock === undefined) {
		return (
			<EditorRootCard dataUi="EditorClockDisabledCard">
				<DisabledCapabilityDetail
					capability="clock"
					itemUid={item.uid}
					actionLabel={translator.textFn("Enable")}
					icon={Clock}
					title={translator.textFn("No Clock configured")}
					summary={translator.textFn("Item clock empty title")}
					size="large"
				/>
			</EditorRootCard>
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
		</div>
	);
};
