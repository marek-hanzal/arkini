import type { ReactNode } from "react";

import { EditorInfoTooltip } from "~/editor-control/ui/EditorInfoTooltip";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";

import { Fact, FactList } from "~/ui/ui/FactList";

export const DetailSection = ({
	children,
	description,
	title,
}: {
	readonly children: ReactNode;
	readonly description?: string;
	readonly title: string;
}) => (
	<section className="grid gap-2 border-t border-line pt-5 first:border-t-0 first:pt-0">
		<EditorFormSectionDivider
			title={title}
			description={description}
		/>
		{children}
	</section>
);

export const DetailFacts = ({
	children,
	columns,
}: {
	readonly children: ReactNode;
	readonly columns?: 2 | 3;
}) => <FactList columns={columns}>{children}</FactList>;

export const DetailFact = ({
	description,
	label,
	mono = false,
	value,
}: {
	readonly description?: string;
	readonly label: string;
	readonly mono?: boolean;
	readonly value: ReactNode;
}) => (
	<Fact
		label={label}
		labelSuffix={
			description === undefined ? undefined : <EditorInfoTooltip content={description} />
		}
		mono={mono}
		value={value}
	/>
);

export const EmptyDetail = ({ children }: { readonly children: ReactNode }) => (
	<p className="text-sm text-muted">{children}</p>
);
