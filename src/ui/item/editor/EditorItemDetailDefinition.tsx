import type { ReactNode } from "react";

import { ItemInfoFact, ItemInfoFacts } from "~/ui/item-detail/ItemInfoPresentation";

export const DetailSection = ({
	children,
	description,
	title,
}: {
	readonly children: ReactNode;
	readonly description?: string;
	readonly title: string;
}) => (
	<section className="grid gap-4 border-t border-line pt-5 first:border-t-0 first:pt-0">
		<header>
			<h2 className="text-lg font-semibold">{title}</h2>
			{description === undefined ? null : (
				<p className="mt-1 text-sm text-muted">{description}</p>
			)}
		</header>
		{children}
	</section>
);

export const DetailFacts = ({ children }: { readonly children: ReactNode }) => (
	<ItemInfoFacts>{children}</ItemInfoFacts>
);

export const DetailFact = ({
	label,
	mono = false,
	value,
}: {
	readonly label: string;
	readonly mono?: boolean;
	readonly value: ReactNode;
}) => (
	<ItemInfoFact
		label={label}
		mono={mono}
		value={value}
	/>
);

export const EmptyDetail = ({ children }: { readonly children: ReactNode }) => (
	<p className="text-sm text-muted">{children}</p>
);
