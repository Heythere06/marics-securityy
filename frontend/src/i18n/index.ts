import en from './en.json';
import af from './af.json';
import pt from './pt.json';

export type Language = 'en' | 'af' | 'pt';
export const translations = { en, af, pt } as const;
export type Translation = typeof en;
export function getTranslations(language: Language): Translation {
  return translations[language] as Translation;
}