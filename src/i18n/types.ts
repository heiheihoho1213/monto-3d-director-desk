export type DirectorDeskLang = "zh" | "en";

export const DIRECTOR_DESK_LANGS = ["zh", "en"] as const;

export type MessageValue = string | { [key: string]: MessageValue };

export type MessageDictionary = { [key: string]: MessageValue };

/** Same nested keys as `T`, but every leaf is `string` (so locale copies can differ). */
export type MessageCatalogShape<T> = {
  [K in keyof T]: T[K] extends string ? string : MessageCatalogShape<T[K]>;
};

export type TranslateVars = Record<string, string | number>;
