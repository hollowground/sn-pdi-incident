import type { Messages } from '../i18n/messages'

function getMotivationName(profileLabel: string, fallbackProfileLabel: string) {
    const trimmed = profileLabel.trim()
    if (!trimmed || trimmed === fallbackProfileLabel) {
        return 'teammate'
    }
    const firstToken = trimmed.split(/\s+/)[0]
    return firstToken || 'teammate'
}

export function buildCompletionMotivation(messages: Messages, profileLabel: string) {
    const templates = messages.completionMotivationTemplates
    if (!templates.length) {
        return ''
    }
    const name = getMotivationName(profileLabel, messages.profile)
    const index = Math.floor(Math.random() * templates.length)
    return templates[index](name)
}
