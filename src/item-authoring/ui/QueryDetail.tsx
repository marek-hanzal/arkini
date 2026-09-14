import { Tx } from "~/translation/ui/Tx";
import { Mx } from "~/translation/ui/Mx";
import { EditorInfoTooltip } from "~/editor-control/ui/EditorInfoTooltip";
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
		<div className="flex flex-wrap items-center gap-1 text-xs text-muted">
			<Tx label={QueryScopePresentation[query.scope].label} />
			<EditorInfoTooltip
				content={<Mx label={QueryScopePresentation[query.scope].description} />}
			/>
			{query.scope === "board" ? (
				<>
					{" "}
					· <Tx label={BoardDistancePresentation[query.distance].label} />
					<EditorInfoTooltip
						content={
							<Mx label={BoardDistancePresentation[query.distance].description} />
						}
					/>
				</>
			) : null}
		</div>
	</div>
);
