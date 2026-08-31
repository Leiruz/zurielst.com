// Vendored from Bklit registry item chart-animation (https://ui.bklit.com/r/chart-animation.json), MIT.
// Copyright (c) 2026 uixmat. See ../LICENSE or ../../LICENSE for the complete notice.
"use client";

import { createContext, type ReactNode, useContext } from "react";

const StaticChartPreviewContext = createContext(false);

/** Disables cartesian reveal clip-path for static docs previews. */
export function StaticChartPreviewProvider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <StaticChartPreviewContext.Provider value={true}>
      {children}
    </StaticChartPreviewContext.Provider>
  );
}

export function useStaticChartPreview() {
  return useContext(StaticChartPreviewContext);
}
