/**
 * I18n context — Spanish default, EN toggle. Mirrors the web app's bilingual
 * model. In-memory only (a real app would persist the choice); the prototype
 * keeps it simple and resets on reload.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Lang, StringKey, strings } from './strings';

type I18nValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  /** Translate a key. Optional `vars` interpolates {name}-style tokens. */
  t: (key: StringKey, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('es');

  const toggle = useCallback(() => {
    setLang((prev) => (prev === 'es' ? 'en' : 'es'));
  }, []);

  const t = useCallback(
    (key: StringKey, vars?: Record<string, string | number>) => {
      const entry = strings[key];
      let out = entry ? entry[lang] : (key as string);
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        }
      }
      return out;
    },
    [lang],
  );

  const value = useMemo<I18nValue>(() => ({ lang, setLang, toggle, t }), [lang, toggle, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
