import type { FC } from "react";
import { match } from "ts-pattern";

import type { ItemSchema } from "~/v1/item/schema/ItemSchema";
import { CodePill, DetailField, DetailSection } from "./DetailPrimitives";
import { LineDetails } from "./LineDetails";
import { OutputDetails } from "./OutputDetails";

export namespace ItemTypeDetails {
	export interface Props {
		item: ItemSchema.Type;
	}
}

export const ItemTypeDetails: FC<ItemTypeDetails.Props> = ({ item }) =>
	match(item)
		.with(
			{
				type: "simple",
			},
			() => (
				<DetailSection
					title="Simple item"
					description="This item has no specialized behavior beyond its shared item fields and optional merges."
				>
					<CodePill>no specialized fields</CodePill>
				</DetailSection>
			),
		)
		.with(
			{
				type: "deposit",
			},
			({ count, output }) => (
				<DetailSection
					title="Deposit"
					description="Finite board capacity that may emit an output when depleted."
				>
					<dl className="grid gap-4 sm:grid-cols-2">
						<DetailField
							label="Initial capacity"
							value={count.toLocaleString()}
						/>
						<DetailField
							label="Depletion output"
							value={output ? "Configured" : "None"}
						/>
					</dl>
					{output ? (
						<div className="mt-4">
							<OutputDetails output={output} />
						</div>
					) : null}
				</DetailSection>
			),
		)
		.with(
			{
				type: "producer",
			},
			({ maxQueueSize, lines }) => (
				<DetailSection
					title={`Producer · ${lines.length} ${lines.length === 1 ? "line" : "lines"}`}
					description="Selectable product lines owned directly by this item."
				>
					<div className="mb-4">
						<CodePill tone="violet">queue {maxQueueSize}</CodePill>
					</div>
					<div className="space-y-4">
						{lines.map((line, index) => (
							<LineDetails
								key={line.id}
								line={line}
								index={index}
							/>
						))}
					</div>
				</DetailSection>
			),
		)
		.with(
			{
				type: "craft",
			},
			({ line }) => (
				<DetailSection
					title="Craft"
					description="A single-use craft item that consumes itself when its line completes."
				>
					<LineDetails line={line} />
				</DetailSection>
			),
		)
		.with(
			{
				type: "stash",
			},
			({ line, output }) => (
				<DetailSection
					title="Stash"
					description="A single-use stash with one product line and an optional post-line output."
				>
					<LineDetails line={line} />
					{output ? (
						<div className="mt-4">
							<p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
								Post-line stash output
							</p>
							<OutputDetails output={output} />
						</div>
					) : null}
				</DetailSection>
			),
		)
		.with(
			{
				type: "cheat:speed:on",
			},
			() => (
				<DetailSection
					title="Speed cheat · on"
					description="Special interaction item that enables accelerated runtime behavior."
				>
					<CodePill tone="emerald">enable speed cheat</CodePill>
				</DetailSection>
			),
		)
		.with(
			{
				type: "cheat:speed:off",
			},
			() => (
				<DetailSection
					title="Speed cheat · off"
					description="Special interaction item that disables accelerated runtime behavior."
				>
					<CodePill tone="rose">disable speed cheat</CodePill>
				</DetailSection>
			),
		)
		.with(
			{
				type: "nuke",
			},
			() => (
				<DetailSection
					title="Nuke"
					description="Special interaction item whose behavior is owned by the runtime."
				>
					<CodePill tone="rose">destructive utility</CodePill>
				</DetailSection>
			),
		)
		.with(
			{
				type: "cheat:inventory",
			},
			() => (
				<DetailSection
					title="Cheat inventory"
					description="Special interaction item that consumes or creates test inventory state."
				>
					<CodePill tone="violet">developer utility</CodePill>
				</DetailSection>
			),
		)
		.exhaustive();
