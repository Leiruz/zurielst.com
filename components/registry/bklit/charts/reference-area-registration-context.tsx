// Vendored from Bklit registry item line-chart (https://ui.bklit.com/r/line-chart.json), MIT.
// Copyright (c) 2026 uixmat. See ../LICENSE or ../../LICENSE for the complete notice.
"use client";

import { createContext, useContext } from "react";
import type { ReferenceAreaConfig } from "./reference-area-config";

export interface ReferenceAreaRegistrationContextValue {
  registerReferenceArea: (id: string, config: ReferenceAreaConfig) => void;
  unregisterReferenceArea: (id: string) => void;
}

export const ReferenceAreaRegistrationContext =
  createContext<ReferenceAreaRegistrationContextValue | null>(null);

export function useReferenceAreaRegistration(): ReferenceAreaRegistrationContextValue | null {
  return useContext(ReferenceAreaRegistrationContext);
}
