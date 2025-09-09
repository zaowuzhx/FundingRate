import { ReactNode } from "react";
import { LandingLayout } from "@/themes/landing/layout";

export default function LocaleLandingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <LandingLayout>{children}</LandingLayout>;
}
