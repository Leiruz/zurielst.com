// Vendored from Bklit registry item utils (https://ui.bklit.com/r/utils.json), MIT.
// Copyright (c) 2026 uixmat. See ../LICENSE or ../../LICENSE for the complete notice.
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
