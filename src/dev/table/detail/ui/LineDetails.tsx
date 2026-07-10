import type { FC } from "react";
import { match } from "ts-pattern";

import type { InputSchema } from "~/v1/input/schema/InputSchema";
import type { LineSchema } from "~/v1/line/schema/LineSchema";
import { CodePill, DetailField } from "./DetailPrimitives";
import { OutputDetails } from "./OutputDetails";
import { LineRuleDetails } from "./RuleDetails";
import { QueryDetails, QuantityDetails, SelectorDetails } from "./SchemaValueDetails";

export namespace InputDetails {
	export interface Props {
		input: InputSchema.Type;
	}
}

export const InputDetails: FC<InputDetails.Props> = ({ input }) =>
	match(input)
		.with(
			{
				type: "simple",
			},
			() => (
				<div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
					<CodePill>simple · no resource</CodePill>
				</div>
			),
		)
		.with(
			{
				type: "materials",
			},
			({ selector, mode, quantity, capacity }) => (
				<div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
					<div className="flex flex-wrap items-center gap-2">
						<CodePill tone="violet">materials</CodePill>
						<SelectorDetails selector={selector} />
						<QuantityDetails quantity={quantity} />
						<CodePill tone={mode === "consume" ? "rose" : "emerald"}>{mode}</CodePill>
						<CodePill>buffer +{capacity}</CodePill>
					</div>
				</div>
			),
		)
		.with(
			{
				type: "deposit",
			},
			({ query, quantity }) => (
				<div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
					<div className="flex flex-wrap items-center gap-2">
						<CodePill tone="amber">deposit capacity</CodePill>
						<QuantityDetails quantity={quantity} />
					</div>
					<div className="mt-3">
						<QueryDetails query={query} />
					</div>
				</div>
			),
		)
		.exhaustive();

export namespace LineDetails {
	export interface Props {
		line: LineSchema.Type;
		index?: number;
	}
}

export const LineDetails: FC<LineDetails.Props> = ({ line, index }) => (
	<article className="rounded-xl border border-slate-700/70 bg-slate-950/45 p-4">
		<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
			<div>
				<p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
					{index === undefined ? "Product line" : `Product line ${index + 1}`}
				</p>
				<h4 className="mt-1 text-base font-semibold text-white">{line.title}</h4>
				<p className="mt-1 max-w-4xl text-sm leading-6 text-slate-400">
					{line.description}
				</p>
			</div>
			<CodePill tone="violet">{line.id}</CodePill>
		</div>

		<dl className="mt-4 grid gap-4 rounded-lg border border-slate-800 bg-slate-900/35 p-3 sm:grid-cols-3">
			<DetailField
				label="Runtime"
				value={`${line.runtimeMs.toLocaleString()} ms`}
			/>
			<DetailField
				label="Visible by default"
				value={
					<CodePill tone={line.show ? "emerald" : "rose"}>{String(line.show)}</CodePill>
				}
			/>
			<DetailField
				label="Enabled by default"
				value={
					<CodePill tone={line.enable ? "emerald" : "rose"}>
						{String(line.enable)}
					</CodePill>
				}
			/>
		</dl>

		<div className="mt-4 grid gap-4 xl:grid-cols-2">
			<section>
				<h5 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
					Inputs · {line.input.length}
				</h5>
				<div className="mt-2 space-y-2">
					{line.input.map((input, inputIndex) => (
						<InputDetails
							key={`${input.type}-${inputIndex}`}
							input={input}
						/>
					))}
				</div>
			</section>

			<section>
				<h5 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
					Rules · {line.rules.length}
				</h5>
				<div className="mt-2 space-y-2">
					{line.rules.length > 0 ? (
						line.rules.map((rule, ruleIndex) => (
							<LineRuleDetails
								key={`${rule.type}-${ruleIndex}`}
								rule={rule}
							/>
						))
					) : (
						<p className="rounded-lg border border-slate-800 bg-slate-900/30 p-3 text-sm text-slate-500">
							No line rules.
						</p>
					)}
				</div>
			</section>
		</div>

		<section className="mt-4">
			<h5 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
				Output
			</h5>
			<div className="mt-2">
				{line.output ? (
					<OutputDetails output={line.output} />
				) : (
					<p className="rounded-lg border border-slate-800 bg-slate-900/30 p-3 text-sm text-slate-500">
						This line emits no output.
					</p>
				)}
			</div>
		</section>
	</article>
);
