import { memo } from "react";

export const BuildHoverIcon = memo(function BuildHoverIcon() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-150 group-hover/cell:opacity-70">
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-8 w-8 text-amber-200 drop-shadow-lg">
        <path
          fill="currentColor"
          d="M13.8 2.7a4.7 4.7 0 0 1 5.6 5.7l-2.1-2.1-2.7 2.7 2.1 2.1a4.7 4.7 0 0 1-5.8-5.8L3.3 12.9a2.1 2.1 0 0 0 0 3l4.8 4.8a2.1 2.1 0 0 0 3 0l7.6-7.6a6.4 6.4 0 0 0 2.4-7.9l-.4-.9-4.5 4.5-1-1 4.5-4.5-.9-.4a6.4 6.4 0 0 0-5-.2ZM4.8 14.4l7.5-7.5 4.8 4.8-7.5 7.5a.4.4 0 0 1-.6 0l-4.2-4.2a.4.4 0 0 1 0-.6Z"
        />
      </svg>
    </div>
  );
});
