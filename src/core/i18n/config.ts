import { defineRouting } from "next-intl/routing";
import {
  locales,
  defaultLocale,
  localePrefix,
  localeDetection,
} from "@/config/locale";

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix,
  localeDetection,
});
