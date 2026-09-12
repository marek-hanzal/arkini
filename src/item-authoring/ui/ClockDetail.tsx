import { RulesDetail } from "~/item-authoring/ui/RulesDetail";
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
					title={translator.textFn("Item clock empty title")}
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
						description={translator.textFn(
							"Time between automatic impulses on the Clock-selected line. Without an interval, the item only waits for its lifetime to expire.",
						)}
						value={
							clock.intervalMs === undefined
								? translator.textFn("None")
								: formatDurationFn(clock.intervalMs)
						}
					/>
					<DetailFact
						label={translator.textFn("Lifetime")}
						description={translator.textFn(
							"Running lifetime before expiry. Without a lifetime, the clock repeats indefinitely. Accepted production finishes before the item disappears.",
						)}
						value={
							clock.durationMs === undefined
								? translator.textFn("Unlimited")
								: formatDurationFn(clock.durationMs)
						}
					/>
					<DetailFact
						label={translator.textFn("Timer")}
						description={translator.textFn(
							"Allows the timer to run before availability rules are applied.",
						)}
						value={translator.textFn(clock.enable ? "Enabled" : "Disabled")}
					/>
				</DetailFacts>
				<RulesDetail
					rules={clock.rules}
					description={translator.textFn(
						"Every condition of a rule must pass. Every Enable rule gates the timer; a matching Disable rule pauses it. Accepted production can finish while the clock is paused.",
					)}
				/>
			</EditorRootCard>
			{clock.durationMs === undefined ? null : (
				<EditorRootCard dataUi="EditorClockExpiryOutputCard">
					<OutputDetail
						emptyLabel={translator.textFn("No expiry output configured.")}
						output={clock.onExpire}
						description={translator.textFn(
							"Resolved when the lifetime expires. The item disappears after expiry and accepted production have settled, even without an expiry output.",
						)}
						title={translator.textFn("Expiry output")}
					/>
				</EditorRootCard>
			)}
		</div>
	);
};
