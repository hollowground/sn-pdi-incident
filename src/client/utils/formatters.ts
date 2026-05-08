export function formatDuration(seconds: number) {
    const safeSeconds = Math.max(0, Math.floor(seconds))
    const hours = String(Math.floor(safeSeconds / 3600)).padStart(2, '0')
    const minutes = String(Math.floor((safeSeconds % 3600) / 60)).padStart(2, '0')
    const remaining = String(safeSeconds % 60).padStart(2, '0')
    return `${hours}:${minutes}:${remaining}`
}

export function formatDate(input: string, locale: string, emptyLabel: string) {
    if (!input) {
        return emptyLabel
    }

    const parsed = new Date(input)
    if (Number.isNaN(parsed.getTime())) {
        return input
    }

    return new Intl.DateTimeFormat(locale, {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(parsed)
}

export function formatNextTime(input: string, locale: string, emptyLabel: string) {
    if (!input) {
        return emptyLabel
    }

    const parsed = new Date(input)
    if (Number.isNaN(parsed.getTime())) {
        return input
    }

    return new Intl.DateTimeFormat(locale, {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        month: '2-digit',
        day: '2-digit',
    }).format(parsed)
}
