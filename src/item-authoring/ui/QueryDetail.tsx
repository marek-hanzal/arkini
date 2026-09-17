import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
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
export const QueryDetail = ({
	query,
	heading,
	description,
	eyebrow,
}: {
	readonly query: QuerySchema.Type;
	readonly heading?: ReactNode;
	readonly description?: ReactNode;
	readonly eyebrow?: ReactNode;
}) => (
	<SelectorDetail
		selector={query.selector}
		eyebrow={eyebrow}
		description={
			<>
				{description}
				<span className="flex flex-wrap items-center gap-1 text-xs text-muted">
					{heading === undefined ? null : (
						<>
							<span className="font-medium">{heading}</span>
							<ArrowRight className="mx-1 size-4 shrink-0" />
						</>
					)}
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
									<Mx
										label={
											BoardDistancePresentation[query.distance].description
										}
									/>
								}
							/>
						</>
					) : null}
				</span>
			</>
		}
	/>
);
