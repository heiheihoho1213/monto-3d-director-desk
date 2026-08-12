import { createContext, useContext, useMemo, type ReactNode } from "react";
import { enMessages } from "./en";
import type { DirectorDeskLang, MessageDictionary, MessageValue, TranslateVars } from "./types";
import { zhMessages } from "./zh";

export type { DirectorDeskLang } from "./types";
export { DIRECTOR_DESK_LANGS } from "./types";

const dictionaries: Record<DirectorDeskLang, MessageDictionary> = {
  zh: zhMessages,
  en: enMessages,
};

function resolvePath(dictionary: MessageDictionary, path: string): string | undefined {
  const segments = path.split(".");
  let current: MessageValue | undefined = dictionary;

  for (const segment of segments) {
    if (!current || typeof current === "string") return undefined;
    current = current[segment];
  }

  return typeof current === "string" ? current : undefined;
}

function interpolate(template: string, vars?: TranslateVars) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = vars[key];
    return value == null ? `{${key}}` : String(value);
  });
}

export function createTranslator(lang: DirectorDeskLang) {
  const dictionary = dictionaries[lang] ?? dictionaries.zh;
  const fallback = dictionaries.zh;

  return function t(path: string, vars?: TranslateVars) {
    const message = resolvePath(dictionary, path) ?? resolvePath(fallback, path) ?? path;
    return interpolate(message, vars);
  };
}

export type Translator = ReturnType<typeof createTranslator>;

type I18nContextValue = {
  lang: DirectorDeskLang;
  t: Translator;
};

const I18nContext = createContext<I18nContextValue>({
  lang: "zh",
  t: createTranslator("zh"),
});

export function I18nProvider({
  lang = "zh",
  children,
}: {
  lang?: DirectorDeskLang;
  children: ReactNode;
}) {
  const value = useMemo<I18nContextValue>(() => {
    const normalized: DirectorDeskLang = lang === "en" ? "en" : "zh";
    return {
      lang: normalized,
      t: createTranslator(normalized),
    };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

export function useT() {
  return useI18n().t;
}
