import { encodeGameProjectFileStem } from "~/engine/source/encodeGameProjectFileStem";

/** Derives the canonical artifact pair owned by one package identity. */
export const readArkpackArtifactNames = (packageId: string) => {
	const stem = encodeGameProjectFileStem(packageId);
	return {
		arkpack: `${stem}.arkpack`,
		signature: `${stem}.arksig`,
	} as const;
};
