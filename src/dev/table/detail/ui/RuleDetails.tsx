import type { FC } from "react";
import { match } from "ts-pattern";

import type { RuleSchema as LineRuleSchema } from "~/v1/line/schema/rule/RuleSchema";
import type { RuleSchema as DropRuleSchema } from "~/v1/output/schema/drop/rule/RuleSchema";
import { CodePill } from "./DetailPrimitives";
import { WhenDetails } from "./SchemaValueDetails";

const WhenList: FC<{
	when: LineRuleSchema.Type["when"] | DropRuleSchema.Type["when"];
}> = ({ when }) => (
	<div className="mt-3 space-y-2 border-l border-slate-800 pl-3">
		{when.map((condition, index) => (
			<WhenDetails
				key={`${condition.type}-${index}`}
				when={condition}
			/>
		))}
	</div>
);

export namespace LineRuleDetails {
	export interface Props {
		rule: LineRuleSchema.Type;
	}
}

export const LineRuleDetails: FC<LineRuleDetails.Props> = ({ rule }) => {
	const heading = match(rule)
		.with(
			{
				type: "show",
			},
			() => <CodePill tone="emerald">show line</CodePill>,
		)
		.with(
			{
				type: "hide",
			},
			() => <CodePill tone="rose">hide line</CodePill>,
		)
		.with(
			{
				type: "enable",
			},
			() => <CodePill tone="emerald">enable line</CodePill>,
		)
		.with(
			{
				type: "disable",
			},
			() => <CodePill tone="rose">disable line</CodePill>,
		)
		.with(
			{
				type: "require",
			},
			() => <CodePill tone="amber">require</CodePill>,
		)
		.with(
			{
				type: "runtime:multiplier",
			},
			({ multiplier }) => <CodePill tone="violet">runtime × {multiplier}</CodePill>,
		)
		.exhaustive();

	return (
		<div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
			{heading}
			<WhenList when={rule.when} />
		</div>
	);
};

export namespace DropRuleDetails {
	export interface Props {
		rule: DropRuleSchema.Type;
	}
}

export const DropRuleDetails: FC<DropRuleDetails.Props> = ({ rule }) => {
	const heading = match(rule)
		.with(
			{
				type: "require",
			},
			() => <CodePill tone="amber">require drop</CodePill>,
		)
		.with(
			{
				type: "block",
			},
			() => <CodePill tone="rose">block drop</CodePill>,
		)
		.exhaustive();

	return (
		<div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
			{heading}
			<WhenList when={rule.when} />
		</div>
	);
};
