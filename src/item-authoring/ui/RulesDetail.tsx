import { match } from "ts-pattern";
import type { RuleSchema } from "~/production-line/schema/RuleSchema";
import type { WhenSchema } from "~/production-condition/schema/WhenSchema";
import { EditorInfoTooltip } from "~/editor-control/ui/EditorInfoTooltip";
import { SelectorDetail } from "~/item-authoring/ui/SelectorDetail";
import { QueryDetail } from "~/item-authoring/ui/QueryDetail";
import { Tx } from "~/translation/ui/Tx";
import { formatDurationFn } from "~/ui/fn/formatDurationFn";
import type { ReactNode } from "react";

const RuleLabel = ({ rule }: { readonly rule: RuleSchema.Type }) => (
	<span className="mb-1 flex items-center gap-1 text-sm font-semibold text-accent">
		{match(rule)
			.with(
				{
					type: "enable",
				},
				() => <Tx label="Enable" />,
			)
			.with(
				{
					type: "disable",
				},
				() => <Tx label="Disable" />,
			)
			.with(
				{
					type: "show",
				},
				() => <Tx label="Show" />,
			)
			.with(
				{
					type: "hide",
				},
				() => <Tx label="Hide" />,
			)
			.with(
				{
					type: "runtime:multiplier",
				},
				(value) => (
					<>
						<Tx label="Runtime multiplier" /> × {value.multiplier}
					</>
				),
			)
			.with(
				{
					type: "runtime:adjust",
				},
				(value) => (
					<>
						<Tx label="Runtime adjustment" /> · {value.adjustMs < 0 ? "−" : "+"}
						{formatDurationFn(Math.abs(value.adjustMs))}
					</>
				),
			)
			.exhaustive()}
		{rule.hint === undefined ? null : (
			<EditorInfoTooltip
				content={
					<>
						<Tx label="Player hint" />: {rule.hint}
					</>
				}
			/>
		)}
	</span>
);

const WhenDetail = ({
	when,
	eyebrow,
}: {
	readonly when: WhenSchema.Type;
	readonly eyebrow: ReactNode;
}) => {
	const heading = match(when)
		.with(
			{
				type: "exists",
			},
			() => <Tx label="Exists" />,
		)
		.with(
			{
				type: "count",
			},
			(condition) => (
				<>
					<Tx label="Exact count" /> · {condition.count}
				</>
			),
		)
		.with(
			{
				type: "range",
			},
			(condition) => (
				<>
					<Tx label="Count range" /> · {condition.min}–{condition.max}
				</>
			),
		)
		.with(
			{
				type: "limit",
			},
			() => <Tx label="Limit" />,
		)
		.exhaustive();
	return (
		<li className="grid gap-1">
			{when.type === "limit" ? (
				<SelectorDetail
					eyebrow={eyebrow}
					description={heading}
					selector={{
						type: "item",
						itemId: when.itemId,
					}}
				/>
			) : (
				<QueryDetail
					eyebrow={eyebrow}
					query={when.query}
					heading={heading}
				/>
			)}
		</li>
	);
};

/** Shows authored conditions directly for line, action, clock, and selected-drop rules. */
export const RulesDetail = ({ rules }: { readonly rules: readonly RuleSchema.Type[] }) => {
	return (
		<section
			className="grid gap-3"
			data-ui="EditorRulesDetail"
		>
			{rules.length === 0 ? (
				<p className="text-sm text-muted">
					<Tx label="No rules" />
				</p>
			) : (
				<ul className="divide-y divide-line/60 text-sm">
					{rules.map((rule, index) => (
						<li
							className="grid gap-2 py-3 first:pt-0 last:pb-0"
							key={`${rule.type}-${index}`}
						>
							<ul className="grid gap-3 border-l-2 border-accent pl-24 text-muted">
								{rule.when.map((when, whenIndex) => (
									<WhenDetail
										key={`${when.type}-${whenIndex}`}
										when={when}
										eyebrow={<RuleLabel rule={rule} />}
									/>
								))}
							</ul>
						</li>
					))}
				</ul>
			)}
		</section>
	);
};
