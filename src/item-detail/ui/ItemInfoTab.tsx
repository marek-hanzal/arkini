import { Button } from "~/ui/ui/Button";
import type { useRuntimeItemDetailSceneController } from "~/item-detail/ui/useRuntimeItemDetailSceneController";
import type { readItemDetailScheduleFx } from "~/item-detail-read/fx/readItemDetailScheduleFx";
import { formatDurationFn } from "~/ui/fn/formatDurationFn";
import { match } from "ts-pattern";

import type { readItemDetailInfoFn } from "~/item-detail-read/fn/readItemDetailInfoFn";
import type { StorageSchema } from "~/item-definition/schema/StorageSchema";
import type { TypeSchema } from "~/item-definition/schema/TypeSchema";
import { useTranslator } from "~/translation/ui/useTranslator";
import { Fact, FactList } from "~/ui/ui/FactList";
import { Scrollable } from "~/ui/ui/Scrollable";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";

export namespace ItemInfoTab {
	export interface Detail {
		readonly description?: string;
		readonly schedule?: readItemDetailScheduleFx.Schedule;
		readonly itemType: TypeSchema.Type;
		readonly storageScope: StorageSchema.Type;
		readonly location?: readItemDetailInfoFn.Location;
		readonly currentStack?: number;
		readonly maxStackSize: number;
		readonly ownedQuantity?: number;
		readonly maxCount?: number;
		readonly units?: {
			readonly label: "Units" | "Units per item";
			readonly value: string;
		};
	}
}

const readStackCapacityLabelFn = (maxStackSize: number) =>
	maxStackSize === 1 ? "Single item" : `${maxStackSize} items`;

const readOwnedLabelFn = (ownedQuantity: number, maxCount: number | undefined) =>
	`${ownedQuantity}${maxCount === undefined ? "" : ` / ${maxCount}`}`;

const readGameLimitLabelFn = (maxCount: number | undefined) =>
	maxCount === undefined ? "No configured limit" : `${maxCount}`;

const readLocationLabelFn = (location: readItemDetailInfoFn.Location) =>
	match(location)
		.with(
			{
				kind: "board",
			},
			({ space }) => `Board · Space ${space + 1}`,
		)
		.with(
			{
				kind: "inventory",
			},
			() => "Inventory",
		)
		.with(
			{
				kind: "toolbar",
			},
			() => "Toolbar",
		)
		.with(
			{
				kind: "input",
			},
			() => "Stored line input",
		)
		.with(
			{
				kind: "job",
			},
			() => "Consumed by active work",
		)
		.with(
			{
				kind: "reserved",
			},
			() => "Reserved by active work",
		)
		.with(
			{
				kind: "delivery",
			},
			() => "In delivery",
		)
		.exhaustive();

/** Renders the canonical description-and-facts presentation for configured and live items. */
export const ItemInfoTab = ({
	detail,
	scheduleControl,
}: {
	readonly detail: ItemInfoTab.Detail;
	readonly scheduleControl?: useRuntimeItemDetailSceneController.ScheduleControl;
}) => {
	const translator = useTranslator();
	const schedule = detail.schedule;
	const scheduleRuntime = schedule?.runtime;
	const fact = [
		{
			label: translator.textFn("Type"),
			value: translator.textFn(`Item type - ${detail.itemType}`),
		},
		...(detail.location === undefined
			? []
			: [
					{
						label: translator.textFn("Location"),
						value: readLocationLabelFn(detail.location),
					},
				]),
		{
			label: translator.textFn("Storage"),
			value:
				detail.itemType === "inventory"
					? translator.textFn("Item storage scope - inventory-control")
					: translator.textFn(`Item storage scope - ${detail.storageScope}`),
		},
		...(detail.currentStack === undefined
			? []
			: [
					{
						label: translator.textFn("Current stack"),
						value: `${detail.currentStack} ${detail.currentStack === 1 ? "item" : "items"}`,
					},
				]),
		{
			label: translator.textFn("Stack capacity"),
			value: readStackCapacityLabelFn(detail.maxStackSize),
		},
		...(detail.ownedQuantity === undefined
			? []
			: [
					{
						label: translator.textFn("Owned"),
						value: readOwnedLabelFn(detail.ownedQuantity, detail.maxCount),
					},
				]),
		{
			label: translator.textFn("Game limit"),
			value: readGameLimitLabelFn(detail.maxCount),
		},
		...(detail.units === undefined
			? []
			: [
					{
						...detail.units,
						label:
							detail.units.label === "Units"
								? translator.textFn("Units")
								: translator.textFn("Units per item"),
					},
				]),
		...(schedule === undefined
			? []
			: [
					{
						label: translator.textFn("Interval"),
						value: formatDurationFn(schedule.intervalMs),
					},
					{
						label: translator.textFn("Lifetime"),
						value:
							schedule.durationMs === undefined
								? translator.textFn("Unlimited")
								: formatDurationFn(schedule.durationMs),
					},
					{
						label: translator.textFn("Control"),
						value:
							schedule.control === "interactive"
								? translator.textFn("Interactive")
								: translator.textFn("Automatic only"),
					},
					...(schedule.runtime === undefined
						? []
						: [
								{
									label: translator.textFn("Schedule"),
									value:
										schedule.runtime.status === "draining"
											? translator.textFn("Finishing accepted work")
											: schedule.runtime.status === "running"
												? translator.textFn("Running")
												: translator.textFn("Paused"),
								},
								...(schedule.runtime.status === "draining"
									? []
									: [
											{
												label: translator.textFn("Next pulse"),
												value: formatDurationFn(
													schedule.runtime.remainingIntervalMs,
												),
											},
											...(schedule.runtime.remainingDurationMs === undefined
												? []
												: [
														{
															label: translator.textFn(
																"Lifetime remaining",
															),
															value: formatDurationFn(
																schedule.runtime
																	.remainingDurationMs,
															),
														},
													]),
										]),
							]),
				]),
	];
	return (
		<Scrollable
			className="h-full pr-1"
			data-ui="ItemInfoTab"
		>
			{detail.description === undefined ? null : (
				<section className="pb-5">
					<p
						className="max-w-4xl text-pretty text-base leading-relaxed text-muted"
						data-ui="ItemInfoDescription"
					>
						{detail.description}
					</p>
				</section>
			)}

			<section
				className="pt-2 data-[ui-has-description=true]:border-t data-[ui-has-description=true]:border-line"
				{...readDataUiFn({
					dataUi: "ItemInfoFacts",
					state: {
						hasDescription: detail.description !== undefined,
					},
				})}
			>
				<FactList>
					{fact.map((entry) => (
						<Fact
							key={entry.label}
							dataUi="ItemInfoFact"
							label={entry.label}
							value={entry.value}
						/>
					))}
					{schedule?.control === "interactive" &&
					scheduleRuntime !== undefined &&
					scheduleControl !== undefined ? (
						<Fact
							label={translator.textFn("Timer control")}
							value={
								<div className="flex flex-col items-start gap-2">
									<Button
										data-ui="ItemScheduleRunningButton"
										disabled={
											scheduleControl.pending ||
											scheduleRuntime.status === "draining"
										}
										cursorIntent={
											scheduleControl.pending ? "progress" : undefined
										}
										onClick={() =>
											scheduleControl.setRunningFn(!scheduleRuntime.running)
										}
									>
										{scheduleRuntime.running
											? translator.textFn("Turn off")
											: translator.textFn("Turn on")}
									</Button>
									{scheduleControl.error === null ? null : (
										<p className="text-sm text-danger">
											{scheduleControl.error}
										</p>
									)}
								</div>
							}
						/>
					) : null}
				</FactList>
			</section>
		</Scrollable>
	);
};
