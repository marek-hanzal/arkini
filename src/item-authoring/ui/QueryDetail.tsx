import type { QuerySchema } from "~/item-query/schema/QuerySchema";
import {
	BoardDistancePresentation,
	QueryScopePresentation,
} from "~/item-query/ui/QueryPresentation";
import { SelectorDetail } from "~/item-authoring/ui/SelectorDetail";

/** Presents one authored item query with its linked item, human scope, and board distance. */
export const QueryDetail = ({ query }: { readonly query: QuerySchema.Type }) => (
	<div className="grid min-w-0 gap-1">
		<SelectorDetail selector={query.selector} />
		<p className="text-xs text-muted">
			{QueryScopePresentation[query.scope].label}
			{query.scope === "board" ? ` · ${BoardDistancePresentation[query.distance].label}` : ""}
		</p>
	</div>
);
