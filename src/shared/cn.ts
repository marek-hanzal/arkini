import { twMerge } from "tailwind-merge";

export function cn(...classNames: Parameters<typeof twMerge>) {
  return twMerge(...classNames);
}
