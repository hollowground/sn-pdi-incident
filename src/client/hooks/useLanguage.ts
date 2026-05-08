import { useEffect, useMemo, useState } from 'react'
import { LANGUAGE_OPTIONS, MESSAGES_BY_LANGUAGE, type LanguageCode } from '../i18n/messages'
import { STORAGE_KEYS } from '../utils/storage'

function resolveInitialLanguage(): LanguageCode {
    try {
        const saved = window.localStorage.getItem(STORAGE_KEYS.language)
        if (saved === 'en' || saved === 'es' || saved === 'fr') {
            return saved
        }
    } catch {
        // noop
    }

    const browser = window.navigator.language.toLowerCase()
    if (browser.startsWith('es')) {
        return 'es'
    }
    if (browser.startsWith('fr')) {
        return 'fr'
    }
    return 'en'
}

export function useLanguage() {
    const [language, setLanguage] = useState<LanguageCode>(() => resolveInitialLanguage())
    const messages = useMemo(() => MESSAGES_BY_LANGUAGE[language], [language])
    const locale = useMemo(
        () => LANGUAGE_OPTIONS.find((option) => option.code === language)?.locale || 'en-US',
        [language]
    )
    const languageLabel = useMemo(
        () => LANGUAGE_OPTIONS.find((option) => option.code === language)?.label || 'English',
        [language]
    )

    useEffect(() => {
        try {
            window.localStorage.setItem(STORAGE_KEYS.language, language)
        } catch {
            // noop
        }
    }, [language])

    return {
        language,
        setLanguage,
        messages,
        locale,
        languageLabel,
    }
}
