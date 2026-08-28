import { encodeGameProjectFileStem } from "~/engine/source/encodeGameProjectFileStem";

/** Derives the canonical self-contained artifact owned by one package identity. */
export const readArkpackArtifactName = (packageId: string) =>
	`${encodeGameProjectFileStem(packageId)}.arkpack`;
