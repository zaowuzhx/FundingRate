import "@/config/style/global.css";

import { getLocale, setRequestLocale } from "next-intl/server";
import { locales } from "@/config/locale";
import { getConfigs } from "@/config";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  setRequestLocale(locale);

  const configs = getConfigs();
  const baseUrl = configs.webUrl || "";
  const adsenseCode = configs.adsenseCode || "";

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {adsenseCode && (
          <meta name="google-adsense-account" content={adsenseCode} />
        )}

        <link rel="icon" href="/favicon.ico" />

        {locales ? (
          <>
            {locales.map((loc) => (
              <link
                key={loc}
                rel="alternate"
                hrefLang={loc}
                href={`${baseUrl}${loc === "en" ? "" : `/${loc}`}/`}
              />
            ))}
            <link rel="alternate" hrefLang="x-default" href={baseUrl} />
          </>
        ) : null}
      </head>
      <body>{children}</body>
    </html>
  );
}
