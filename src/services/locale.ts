export async function getLocaleData(locale: string) {
  const localeData = await import(`@/config/locale/${locale}.json`);
  return localeData;
}

export async function getLocaleDataByPath(path: string) {
  const localeData = await import(`@/config/locale/${path}.json`);
  return localeData;
}
