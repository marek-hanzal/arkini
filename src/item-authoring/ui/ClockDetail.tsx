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
						description={translator.textFn(
							"Running lifetime before expiry. Without a lifetime, the clock repeats indefinitely. Expiry mode controls unfinished production.",
						)}
						value={
							clock.durationMs === undefined
								? translator.textFn("Unlimited")
								: formatDurationFn(clock.durationMs)
						}
					/>
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
					{clock.durationMs === undefined ? null : (
						<DetailFact
							label={translator.textFn("Expiry mode")}
							value={translator.textFn(
								clock.expiryMode === "kill-switch" ? "Kill switch" : "Loose-kill",
							)}
							description={translator.textFn(
								clock.expiryMode === "kill-switch"
									? "Cancel work and remove the item atomically. Place reserved items first, then unused buffers and expiry output. Anything that does not fit is lost and logged."
									: "Wait for accepted production to settle. A job blocked on output space keeps this item alive.",
							)}
						/>
					)}
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
							"Resolved once when the item expires. Kill switch places what fits after returned materials; excess output is lost and logged.",
						)}
						title={translator.textFn("Expiry output")}
					/>
				</EditorRootCard>
			)}
		</div>
	);
};
