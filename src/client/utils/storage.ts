export const STORAGE_KEYS = {
    incidentCache: 'incident-workflow-cache-v1',
    pendingMutations: 'incident-workflow-pending-v1',
    reportedIncidentIds: 'incident-workflow-reported-v1',
    language: 'incident-workflow-language-v1',
} as const

export function readJson<T>(key: string, fallback: T): T {
    try {
        const raw = window.localStorage.getItem(key)
        if (!raw) {
            return fallback
        }
        return JSON.parse(raw) as T
    } catch {
        return fallback
    }
}

export function writeJson<T>(key: string, value: T) {
    try {
        window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
        // noop
    }
}
