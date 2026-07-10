import type { FC } from "react";
import { match } from "ts-pattern";

import type { DropSchema } from "~/v1/output/schema/DropSchema";
import type { OutputSchema } from "~/v1/output/schema/OutputSchema";
import type { RollSchema } from "~/v1/roll/schema/RollSchema";
import { useDevGamePack } from "../../../pack/hook/useDevGamePack";
import { CodePill } from "./DetailPrimitives";
import { DropRuleDetails } from "./RuleDetails";
import { QuantityDetails } from "./SchemaValueDetails";

export namespace DropDetails {
	export interface Props {
		drop: DropSchema.Type;
	}
}

export const DropDetails: FC<DropDetails.Props> = ({ drop }) => {
	const { config } = useDevGamePack();
	const item = config?.items[drop.itemId];

	return (
		<div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
			<div className="flex flex-wrap items-center gap-2">
				<CodePill tone="violet">{drop.itemId}</CodePill>
				<QuantityDetails quantity={drop.quantity} />
				<CodePill>{drop.placement}</CodePill>
			</div>
			{item ? <p className="mt-2 text-sm font-medium text-slate-200">{item.title}</p> : null}
			{drop.rules.length > 0 ? (
				<div className="mt-3 space-y-2">
					{drop.rules.map((rule, index) => (
						<DropRuleDetails
							key={`${rule.type}-${index}`}
							rule={rule}
						/>
					))}
				</div>
			) : null}
		</div>
	);
};

export namespace RollDetails {
	export interface Props {
		roll: RollSchema.Type;
	}
}

export const RollDetails: FC<RollDetails.Props> = ({ roll }) =>
	match(roll)
		.with(
			{
				type: "guaranteed",
			},
			({ drop }) => (
				<div className="rounded-xl border border-emerald-900/40 bg-emerald-950/15 p-3">
					<CodePill tone="emerald">guaranteed</CodePill>
					<div className="mt-3 grid gap-2 xl:grid-cols-2">
						{drop.map((value, index) => (
							<DropDetails
								key={`${value.itemId}-${index}`}
								drop={value}
							/>
						))}
					</div>
				</div>
			),
		)
		.with(
			{
				type: "chance",
			},
			({ chance, drop }) => (
				<div className="rounded-xl border border-amber-900/40 bg-amber-950/15 p-3">
					<CodePill tone="amber">chance {(chance * 100).toFixed(1)}%</CodePill>
					<div className="mt-3 grid gap-2 xl:grid-cols-2">
						{drop.map((value, index) => (
							<DropDetails
								key={`${value.itemId}-${index}`}
								drop={value}
							/>
						))}
					</div>
				</div>
			),
		)
		.with(
			{
				type: "weight",
			},
			({ quantity, drop }) => (
				<div className="rounded-xl border border-violet-900/40 bg-violet-950/15 p-3">
					<div className="flex flex-wrap items-center gap-2">
						<CodePill tone="violet">weighted</CodePill>
						<span className="text-xs text-slate-500">selections</span>
						<QuantityDetails quantity={quantity} />
					</div>
					<div className="mt-3 space-y-3">
						{drop.map((candidate, index) => (
							<div
								key={`${candidate.weight}-${index}`}
								className="rounded-lg border border-violet-900/30 bg-slate-950/50 p-3"
							>
								<CodePill tone="violet">weight {candidate.weight}</CodePill>
								<div className="mt-3 grid gap-2 xl:grid-cols-2">
									{candidate.drop.map((value, dropIndex) => (
										<DropDetails
											key={`${value.itemId}-${dropIndex}`}
											drop={value}
										/>
									))}
								</div>
							</div>
						))}
					</div>
				</div>
			),
		)
		.exhaustive();

export namespace OutputDetails {
	export interface Props {
		output: OutputSchema.Type;
	}
}

export const OutputDetails: FC<OutputDetails.Props> = ({ output }) => (
	<div className="space-y-3">
		{output.set.map((set, setIndex) => (
			<div
				key={`${set.weight ?? 1}-${setIndex}`}
				className="rounded-xl border border-slate-800 bg-slate-900/40 p-3"
			>
				<div className="flex items-center gap-2 text-xs text-slate-500">
					<span className="font-semibold uppercase tracking-[0.12em]">
						Set {setIndex + 1}
					</span>
					<CodePill>weight {set.weight ?? 1}</CodePill>
				</div>
				<div className="mt-3 space-y-3">
					{set.roll.map((roll, rollIndex) => (
						<RollDetails
							key={`${roll.type}-${rollIndex}`}
							roll={roll}
						/>
					))}
				</div>
			</div>
		))}
	</div>
);
