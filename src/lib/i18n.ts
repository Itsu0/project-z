import { useStore } from '@/lib/store'
import pl from '@/locales/pl.json'
import en from '@/locales/en.json'

type Lang = 'pl' | 'en'

const dicts: Record<Lang, Record<string, string>> = { pl, en }

export function useT() {
  const language = useStore(s => s.userSettings.language ?? 'pl')
  const dict = dicts[language] ?? pl
  return function t(key: string, vars?: Record<string, string | number>): string {
    let str = (dict as Record<string, string>)[key] ?? (pl as Record<string, string>)[key] ?? key
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(`{${k}}`, String(v))
      }
    }
    return str
  }
}
