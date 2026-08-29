export namespace createArkpackDistributionChannelFn {
	export interface Props {
		readonly issuer: string;
		readonly workflow: string;
	}
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Builds the exact issuer/repository/workflow identity for one distribution channel. */
export const createArkpackDistributionChannelFn = ({
	issuer,
	workflow,
}: createArkpackDistributionChannelFn.Props) => ({
	issuer,
	subjectAlternativeName: new RegExp(`^${escapeRegExp(workflow)}@.+$`),
});
