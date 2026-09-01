import type { ReactNode } from "react";

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
		<header>
			<h2 className="text-lg font-semibold">{title}</h2>
			{description === undefined ? null : (
				<p className="mt-1 text-sm text-muted">{description}</p>
			)}
		</header>
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
	label,
	mono = false,
	value,
}: {
	readonly label: string;
	readonly mono?: boolean;
	readonly value: ReactNode;
}) => (
	<Fact
		label={label}
		mono={mono}
		value={value}
	/>
);

export const EmptyDetail = ({ children }: { readonly children: ReactNode }) => (
	<p className="text-sm text-muted">{children}</p>
);
