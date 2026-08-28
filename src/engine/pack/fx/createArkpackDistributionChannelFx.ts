import { Effect } from "effect";

export namespace createArkpackDistributionChannelFx {
	export interface Props {
		readonly issuer: string;
		readonly workflow: string;
	}
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Builds the exact issuer/repository/workflow identity for one distribution channel. */
export const createArkpackDistributionChannelFx = Effect.fn("createArkpackDistributionChannelFx")(
	({ issuer, workflow }: createArkpackDistributionChannelFx.Props) =>
		Effect.succeed({
			issuer,
			subjectAlternativeName: new RegExp(`^${escapeRegExp(workflow)}@.+$`),
		}),
);
