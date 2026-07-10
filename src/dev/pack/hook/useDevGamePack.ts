import { useContext } from "react";

import { DevGamePackContext } from "../context/DevGamePackContext";

export const useDevGamePack = () => {
	const context = useContext(DevGamePackContext);
	if (!context) {
		throw new Error("useDevGamePack must be used inside DevGamePackProvider.");
	}

	return context;
};
