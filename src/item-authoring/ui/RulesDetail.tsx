import { match } from "ts-pattern";
import type { RuleSchema } from "~/production-line/schema/RuleSchema";
import type { WhenSchema } from "~/production-condition/schema/WhenSchema";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import { EditorInfoTooltip } from "~/editor-control/ui/EditorInfoTooltip";
import { QueryDetail } from "~/item-authoring/ui/QueryDetail";
import { Tx } from "~/translation/ui/Tx";
import { useTranslator } from "~/translation/ui/useTranslator";
import { formatDurationFn } from "~/ui/fn/formatDurationFn";

const WhenDetail = ({ when }: { readonly when: WhenSchema.Type }) => (
	<li className="grid gap-1">
		<p className="font-medium">
			{match(when)
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
				.exhaustive()}
		</p>
		<QueryDetail query={when.query} />
	</li>
);

/** Shows authored conditions directly for line, action, clock, and selected-drop rules. */
export const RulesDetail = ({
	rules,
	description,
}: {
	readonly rules: readonly RuleSchema.Type[];
	readonly description: string;
}) => {
	const translator = useTranslator();
	return (
		<section
			className="grid gap-3"
			data-ui="EditorRulesDetail"
		>
			<EditorFormSectionDivider
				title={translator.textFn("Rules")}
				description={description}
				variant="secondary"
			/>
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
							<div className="flex items-center gap-1 font-medium">
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
												<Tx label="Runtime multiplier" /> ×{" "}
												{value.multiplier}
											</>
										),
									)
									.with(
										{
											type: "runtime:adjust",
										},
										(value) => (
											<>
												<Tx label="Runtime adjustment" /> ·{" "}
												{value.adjustMs < 0 ? "−" : "+"}
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
							</div>
							<ul className="grid gap-2 border-l border-line pl-3 text-muted">
								{rule.when.map((when, whenIndex) => (
									<WhenDetail
										key={`${when.type}-${whenIndex}`}
										when={when}
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
