import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './app.css'
import IncidentForm from './components/IncidentForm'
import { useLanguage } from './hooks/useLanguage'
import { LANGUAGE_OPTIONS, MESSAGES_BY_LANGUAGE, type LanguageCode, type Messages } from './i18n/messages'
import { getActionsForState } from './utils/incidentActions'
import { formatDate, formatDuration, formatNextTime } from './utils/formatters'
import { buildCompletionMotivation } from './utils/motivation'
import { STORAGE_KEYS, readJson, writeJson } from './utils/storage'
import {
    IncidentRecord,
    IncidentService,
    display,
    value,
    type ChoiceOption,
    type IncidentStateValue,
} from './services/IncidentService'

const DEFAULT_ESTIMATE_MINUTES = 15
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000
const INACTIVITY_WARNING_MS = 60 * 1000

const FALLBACK_RESOLUTION_CODES: ChoiceOption[] = [
    { value: 'Duplicate', label: 'Duplicate' },
    { value: 'Known error', label: 'Known error' },
    { value: 'No resolution provided', label: 'No resolution provided' },
    { value: 'Resolved by caller', label: 'Resolved by caller' },
    { value: 'Resolved by change', label: 'Resolved by change' },
    { value: 'Resolved by problem', label: 'Resolved by problem' },
    { value: 'Resolved by request', label: 'Resolved by request' },
    { value: 'Solution provided', label: 'Solution provided' },
    { value: 'Workaround provided', label: 'Workaround provided' },
    { value: 'User error', label: 'User error' },
]

type ReportIssuePayload = {
    short_description: string
    description: string
    impact: string
    urgency: string
}

type PendingMutation =
    | { id: string; type: 'setState'; incidentId: string; state: IncidentStateValue; extraFields?: Record<string, string> }
    | { id: string; type: 'addWorkNote'; incidentId: string; note: string }
    | { id: string; type: 'createIncident'; payload: ReportIssuePayload }

function isNetworkError(error: unknown) {
    if (!(error instanceof Error)) {
        return false
    }
    const message = error.message.toLowerCase()
    return message.includes('failed to fetch') || message.includes('network')
}

function resolveProfileNameFromGlobals() {
    const fromGlobals =
        window.g_user?.getFullName?.() ||
        window.g_user?.fullName ||
        window.g_user?.getUserName?.() ||
        window.g_user?.userName ||
        window.NOW?.user?.name ||
        window.NOW?.user?.fullName ||
        window.NOW?.user?.userName ||
        ''

    return fromGlobals.trim()
}

function ensureStandalonePageMode() {
    const params = new URLSearchParams(window.location.search)
    const isStandalone = params.get('standalone') === '1'
    if (isStandalone) {
        return
    }

    const inShell =
        window.self !== window.top ||
        window.location.pathname.includes('/sp') ||
        window.location.pathname.includes('/now/')
    if (!inShell) {
        return
    }

    const standaloneUrl = `${window.location.origin}/x_961032_incident_incident_manager.do?sysparm_direct=true&sysparm_nostack=true&standalone=1`
    if (window.top && window.top.location.href !== standaloneUrl) {
        window.top.location.href = standaloneUrl
    } else {
        window.location.href = standaloneUrl
    }
}

function logoutUser() {
    const logoutUrl = `${window.location.origin}/logout.do`
    if (window.top) {
        window.top.location.href = logoutUrl
        return
    }
    window.location.href = logoutUrl
}

function navLabel(label: string, maxLength = 10) {
    const trimmed = label.trim()
    if (!trimmed) {
        return ''
    }
    if (trimmed.length <= maxLength) {
        return trimmed
    }
    return `${trimmed.slice(0, maxLength - 1)}…`
}

export default function App() {
    const incidentService = useMemo(() => new IncidentService(), [])
    const { language, setLanguage, messages, locale, languageLabel } = useLanguage()
    const [showLanguageMenu, setShowLanguageMenu] = useState(false)
    const [incidents, setIncidents] = useState<IncidentRecord[]>([])
    const [expanded, setExpanded] = useState<Record<string, boolean>>({})
    const [searchText, setSearchText] = useState('')
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [loading, setLoading] = useState(true)
    const [updatingId, setUpdatingId] = useState('')
    const [inProgressSince, setInProgressSince] = useState<Record<string, number>>({})
    const [nowMs, setNowMs] = useState(Date.now())
    const [activeCommentId, setActiveCommentId] = useState('')
    const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
    const [activeResolveId, setActiveResolveId] = useState('')
    const [resolveDrafts, setResolveDrafts] = useState<Record<string, { code: string; notes: string }>>({})
    const [closeCodeOptions] = useState<ChoiceOption[]>(FALLBACK_RESOLUTION_CODES)
    const [showReportForm, setShowReportForm] = useState(false)
    const [profileLabel, setProfileLabel] = useState(MESSAGES_BY_LANGUAGE.en.profile)
    const [completionFilter, setCompletionFilter] = useState<'all' | 'open' | 'completed'>('all')
    const [toastMessage, setToastMessage] = useState('')
    const seenIncidentIdsRef = useRef<Set<string> | null>(null)
    const syncInFlightRef = useRef(false)
    const [isOnline, setIsOnline] = useState(window.navigator.onLine)
    const [pendingSyncCount, setPendingSyncCount] = useState(0)
    const [hasLoadedFromServer, setHasLoadedFromServer] = useState(false)
    const [inactivityRemainingSeconds, setInactivityRemainingSeconds] = useState<number | null>(null)
    const [reportedIncidentIds, setReportedIncidentIds] = useState<string[]>(() =>
        readJson<string[]>(STORAGE_KEYS.reportedIncidentIds, [])
    )
    const inactivityDeadlineRef = useRef<number>(0)
    const inactivityWarnTimerRef = useRef<number | null>(null)
    const inactivityLogoutTimerRef = useRef<number | null>(null)
    const inactivityCountdownRef = useRef<number | null>(null)
    const inactivityResetRef = useRef<() => void>(() => undefined)
    const shouldAutoRefresh = !updatingId && !activeResolveId && !activeCommentId && !showReportForm

    const getPendingMutations = useCallback(() => readJson<PendingMutation[]>(STORAGE_KEYS.pendingMutations, []), [])
    const setPendingMutations = useCallback((next: PendingMutation[]) => {
        writeJson(STORAGE_KEYS.pendingMutations, next)
        setPendingSyncCount(next.length)
    }, [])
    const markReportedIncident = useCallback((incidentId: string) => {
        const id = incidentId.trim()
        if (!id) {
            return
        }

        setReportedIncidentIds((previous) => {
            if (previous.includes(id)) {
                return previous
            }
            const next = [id, ...previous].slice(0, 200)
            writeJson(STORAGE_KEYS.reportedIncidentIds, next)
            return next
        })
    }, [])
    const enqueueMutation = useCallback(
        (mutation: PendingMutation) => {
            const current = getPendingMutations()
            const next = [...current, mutation]
            setPendingMutations(next)
        },
        [getPendingMutations, setPendingMutations]
    )

    useEffect(() => {
        ensureStandalonePageMode()
    }, [])

    useEffect(() => {
        setPendingSyncCount(getPendingMutations().length)
    }, [getPendingMutations])

    useEffect(() => {
        const onOnline = () => setIsOnline(true)
        const onOffline = () => setIsOnline(false)
        window.addEventListener('online', onOnline)
        window.addEventListener('offline', onOffline)
        return () => {
            window.removeEventListener('online', onOnline)
            window.removeEventListener('offline', onOffline)
        }
    }, [])

    const refreshIncidents = useCallback(async (options?: { silent?: boolean }) => {
        const silent = Boolean(options?.silent)
        if (!silent) {
            setLoading(true)
            setError('')
        }
        try {
            const data = await incidentService.listAssignedToMe()
            writeJson(STORAGE_KEYS.incidentCache, data)
            setHasLoadedFromServer(true)
            const nextIds = new Set(data.map((incident) => value(incident.sys_id)).filter(Boolean))
            const previousIds = seenIncidentIdsRef.current
            if (previousIds) {
                const newlyAssigned = data.filter((incident) => !previousIds.has(value(incident.sys_id)))
                if (newlyAssigned.length === 1) {
                    setToastMessage(messages.newIncidentAssigned(display(newlyAssigned[0].number, messages.incident)))
                } else if (newlyAssigned.length > 1) {
                    setToastMessage(messages.newIncidentsAssigned(newlyAssigned.length))
                }
            }
            seenIncidentIdsRef.current = nextIds
            setIncidents(data)
            setInProgressSince((previous) => {
                const next = { ...previous }
                for (const incident of data) {
                    const id = value(incident.sys_id)
                    const state = value(incident.state)
                    if (state === '2' && !next[id]) {
                        next[id] = Date.now()
                    }
                    if (state !== '2') {
                        delete next[id]
                    }
                }
                return next
            })
        } catch (caughtError) {
            console.error(caughtError)
            if (!isOnline) {
                const cached = readJson<IncidentRecord[]>(STORAGE_KEYS.incidentCache, [])
                if (cached.length > 0) {
                    setIncidents(cached)
                }
            }
            setError((caughtError as Error).message || messages.failedToLoadIncidents)
        } finally {
            if (!silent) {
                setLoading(false)
            }
        }
    }, [incidentService, isOnline, messages])

    const syncPendingMutations = useCallback(async () => {
        if (!window.navigator.onLine || syncInFlightRef.current) {
            return
        }

        const queue = getPendingMutations()
        if (queue.length === 0) {
            return
        }

        syncInFlightRef.current = true
        let processed = 0
        let remaining = [...queue]

        for (const mutation of queue) {
            try {
                if (mutation.type === 'setState') {
                    await incidentService.setState(
                        { sys_id: mutation.incidentId },
                        mutation.state,
                        mutation.extraFields
                    )
                } else if (mutation.type === 'addWorkNote') {
                    await incidentService.addWorkNote({ sys_id: mutation.incidentId }, mutation.note)
                } else {
                    const created = await incidentService.createIncident(mutation.payload)
                    markReportedIncident(value(created.sys_id))
                }

                processed += 1
                remaining = remaining.slice(1)
                setPendingMutations(remaining)
            } catch (caughtError) {
                if (!isNetworkError(caughtError)) {
                    setError((caughtError as Error).message || messages.couldNotSyncOfflineUpdates)
                }
                break
            }
        }

        if (processed > 0) {
            setSuccess(messages.syncedOfflineChanges(processed))
            await refreshIncidents({ silent: true })
        }

        syncInFlightRef.current = false
    }, [getPendingMutations, incidentService, markReportedIncident, messages, refreshIncidents, setPendingMutations])

    useEffect(() => {
        void refreshIncidents()
    }, [refreshIncidents])

    useEffect(() => {
        if (isOnline) {
            void syncPendingMutations()
        }
    }, [isOnline, syncPendingMutations])

    useEffect(() => {
        if (!shouldAutoRefresh) {
            return
        }

        const pollTimer = window.setInterval(() => {
            void refreshIncidents({ silent: true })
        }, 15000)

        const onFocus = () => {
            void refreshIncidents({ silent: true })
        }

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                void refreshIncidents({ silent: true })
            }
        }

        window.addEventListener('focus', onFocus)
        document.addEventListener('visibilitychange', onVisibilityChange)

        return () => {
            window.clearInterval(pollTimer)
            window.removeEventListener('focus', onFocus)
            document.removeEventListener('visibilitychange', onVisibilityChange)
        }
    }, [refreshIncidents, shouldAutoRefresh])

    useEffect(() => {
        const userName = resolveProfileNameFromGlobals()
        if (userName) {
            setProfileLabel(userName)
        }
    }, [])

    useEffect(() => {
        const knownFallbacks = new Set(Object.values(MESSAGES_BY_LANGUAGE).map((entry) => entry.profile))
        if (knownFallbacks.has(profileLabel)) {
            setProfileLabel(messages.profile)
        }
    }, [messages.profile, profileLabel])

    useEffect(() => {
        if (!toastMessage) {
            return
        }

        const timer = window.setTimeout(() => {
            setToastMessage('')
        }, 5000)

        return () => window.clearTimeout(timer)
    }, [toastMessage])

    useEffect(() => {
        if (profileLabel !== messages.profile || incidents.length === 0) {
            return
        }

        const assignedName = display(incidents[0]?.assigned_to).trim()
        if (assignedName) {
            setProfileLabel(assignedName)
        }
    }, [incidents, messages.profile, profileLabel])

    useEffect(() => {
        const timer = window.setInterval(() => {
            setNowMs(Date.now())
        }, 1000)

        return () => window.clearInterval(timer)
    }, [])

    useEffect(() => {
        const clearInactivityTimers = () => {
            if (inactivityWarnTimerRef.current !== null) {
                window.clearTimeout(inactivityWarnTimerRef.current)
                inactivityWarnTimerRef.current = null
            }
            if (inactivityLogoutTimerRef.current !== null) {
                window.clearTimeout(inactivityLogoutTimerRef.current)
                inactivityLogoutTimerRef.current = null
            }
            if (inactivityCountdownRef.current !== null) {
                window.clearInterval(inactivityCountdownRef.current)
                inactivityCountdownRef.current = null
            }
        }

        const startInactivityCountdown = () => {
            const updateCountdown = () => {
                const remainingMs = inactivityDeadlineRef.current - Date.now()
                const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000))
                setInactivityRemainingSeconds(remainingSeconds)
                if (remainingSeconds <= 0 && inactivityCountdownRef.current !== null) {
                    window.clearInterval(inactivityCountdownRef.current)
                    inactivityCountdownRef.current = null
                }
            }

            updateCountdown()
            inactivityCountdownRef.current = window.setInterval(updateCountdown, 1000)
        }

        const resetInactivityTimeout = () => {
            clearInactivityTimers()
            setInactivityRemainingSeconds(null)
            inactivityDeadlineRef.current = Date.now() + INACTIVITY_TIMEOUT_MS

            const warningDelayMs = Math.max(0, INACTIVITY_TIMEOUT_MS - INACTIVITY_WARNING_MS)
            inactivityWarnTimerRef.current = window.setTimeout(() => {
                startInactivityCountdown()
            }, warningDelayMs)

            inactivityLogoutTimerRef.current = window.setTimeout(() => {
                logoutUser()
            }, INACTIVITY_TIMEOUT_MS)
        }
        inactivityResetRef.current = resetInactivityTimeout

        const activityEvents: Array<keyof WindowEventMap> = [
            'pointerdown',
            'keydown',
            'touchstart',
            'scroll',
            'focus',
        ]
        const handleUserActivity = () => {
            resetInactivityTimeout()
        }

        for (const eventName of activityEvents) {
            window.addEventListener(eventName, handleUserActivity, { passive: true })
        }
        resetInactivityTimeout()

        return () => {
            for (const eventName of activityEvents) {
                window.removeEventListener(eventName, handleUserActivity)
            }
            clearInactivityTimers()
            inactivityResetRef.current = () => undefined
        }
    }, [])

    const filteredIncidents = useMemo(() => {
        const search = searchText.toLowerCase().trim()
        if (!search) {
            return incidents
        }

        return incidents.filter((incident) => {
            const number = display(incident.number).toLowerCase()
            const summary = display(incident.short_description).toLowerCase()
            const location = display(incident.location).toLowerCase()
            return number.includes(search) || summary.includes(search) || location.includes(search)
        })
    }, [incidents, searchText])

    const sortedIncidents = useMemo(() => {
        const reportedSet = new Set(reportedIncidentIds)
        const toDueTimestamp = (incident: IncidentRecord) => {
            const raw = display(incident.due_date) || display(incident.opened_at)
            const time = Date.parse(raw)
            return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time
        }

        return [...filteredIncidents].sort((a, b) => {
            const aIsDirect = reportedSet.has(value(a.sys_id))
            const bIsDirect = reportedSet.has(value(b.sys_id))
            if (aIsDirect !== bIsDirect) {
                return aIsDirect ? -1 : 1
            }

            const aIsComplete = value(a.state) === '6' || value(a.state) === '7'
            const bIsComplete = value(b.state) === '6' || value(b.state) === '7'
            if (aIsComplete !== bIsComplete) {
                return aIsComplete ? 1 : -1
            }

            return toDueTimestamp(a) - toDueTimestamp(b)
        })
    }, [filteredIncidents, reportedIncidentIds])
    const sortedWorkQueue = useMemo(() => {
        const reportedSet = new Set(reportedIncidentIds)
        const toDueTimestamp = (incident: IncidentRecord) => {
            const raw = display(incident.due_date) || display(incident.opened_at)
            const time = Date.parse(raw)
            return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time
        }

        return [...incidents].sort((a, b) => {
            const aIsDirect = reportedSet.has(value(a.sys_id))
            const bIsDirect = reportedSet.has(value(b.sys_id))
            if (aIsDirect !== bIsDirect) {
                return aIsDirect ? -1 : 1
            }

            const aIsComplete = value(a.state) === '6' || value(a.state) === '7'
            const bIsComplete = value(b.state) === '6' || value(b.state) === '7'
            if (aIsComplete !== bIsComplete) {
                return aIsComplete ? 1 : -1
            }

            return toDueTimestamp(a) - toDueTimestamp(b)
        })
    }, [incidents, reportedIncidentIds])

    const visibleIncidents = useMemo(() => {
        if (completionFilter === 'open') {
            return sortedIncidents.filter((incident) => {
                const state = value(incident.state)
                return state !== '6' && state !== '7'
            })
        }
        if (completionFilter === 'completed') {
            return sortedIncidents.filter((incident) => {
                const state = value(incident.state)
                return state === '6' || state === '7'
            })
        }
        return sortedIncidents
    }, [completionFilter, sortedIncidents])
    const compactProfileLabel = useMemo(() => navLabel(profileLabel, 9), [profileLabel])
    const headerSummary = useMemo(() => {
        const openIncidents = sortedWorkQueue.filter((incident) => {
            const state = value(incident.state)
            return state !== '6' && state !== '7'
        })
        const nextIncident = openIncidents[0]
        const nextTimeRaw = nextIncident ? display(nextIncident.due_date) || display(nextIncident.opened_at) : ''
        const nextNumber = nextIncident ? display(nextIncident.number, messages.incident) : ''
        const estimatedHours = ((openIncidents.length * DEFAULT_ESTIMATE_MINUTES) / 60).toFixed(1)
        const nextTimeLabel = formatNextTime(nextTimeRaw, locale, messages.noUpcomingDueTime)

        return {
            openCount: openIncidents.length,
            estimateLabel: `${estimatedHours}h`,
            nextWorkLabel: nextIncident ? `${nextNumber} - ${nextTimeLabel}` : messages.noOpenItems,
        }
    }, [locale, messages.incident, messages.noOpenItems, messages.noUpcomingDueTime, sortedWorkQueue])

    const stats = useMemo(() => {
        let complete = 0
        let inProgress = 0
        let onHold = 0

        for (const incident of filteredIncidents) {
            const state = value(incident.state)
            if (state === '6' || state === '7') {
                complete += 1
            } else if (state === '2') {
                inProgress += 1
            } else if (state === '3') {
                onHold += 1
            }
        }

        return {
            complete,
            inProgress,
            onHold,
            remaining: Math.max(0, filteredIncidents.length - complete),
        }
    }, [filteredIncidents])

    const transitionIncident = async (
        incident: IncidentRecord,
        nextState: IncidentStateValue,
        extraFields?: Record<string, string>
    ) => {
        const incidentId = value(incident.sys_id)
        if (!incidentId) {
            return
        }

        if (!isOnline) {
            enqueueMutation({
                id: `${Date.now()}-${Math.random()}`,
                type: 'setState',
                incidentId,
                state: nextState,
                extraFields,
            })
            setIncidents((previous) =>
                previous.map((item) => (value(item.sys_id) === incidentId ? { ...item, state: { value: nextState } } : item))
            )
            setSuccess(messages.offlineIncidentUpdateQueued)
            return
        }

        setUpdatingId(incidentId)
        setError('')

        try {
            await incidentService.setState(incident, nextState, extraFields)
            setIncidents((previous) =>
                previous.map((item) => (value(item.sys_id) === incidentId ? { ...item, state: { value: nextState } } : item))
            )

            setInProgressSince((previous) => {
                const next = { ...previous }
                if (nextState === '2') {
                    next[incidentId] = Date.now()
                } else {
                    delete next[incidentId]
                }
                return next
            })
            if (nextState === '6') {
                const completionMessage = buildCompletionMotivation(messages, profileLabel)
                if (completionMessage) {
                    setToastMessage(completionMessage)
                }
            }
        } catch (caughtError) {
            console.error(caughtError)
            if (isNetworkError(caughtError)) {
                enqueueMutation({
                    id: `${Date.now()}-${Math.random()}`,
                    type: 'setState',
                    incidentId,
                    state: nextState,
                    extraFields,
                })
                setIncidents((previous) =>
                    previous.map((item) => (value(item.sys_id) === incidentId ? { ...item, state: { value: nextState } } : item))
                )
                setSuccess(messages.connectionLostIncidentUpdateQueued)
            } else {
                setError((caughtError as Error).message || messages.couldNotUpdateIncidentState)
            }
        } finally {
            setUpdatingId('')
        }
    }

    const submitCompletion = async (incident: IncidentRecord) => {
        const incidentId = value(incident.sys_id)
        const draft = resolveDrafts[incidentId] || { code: '', notes: '' }
        const closeCode = draft.code.trim()
        const closeNotes = draft.notes.trim()
        if (!incidentId || !closeCode || !closeNotes) {
            return
        }

        await transitionIncident(incident, '6', {
            close_code: closeCode,
            close_notes: closeNotes,
        })
        setActiveResolveId('')
    }

    const submitComment = async (incident: IncidentRecord) => {
        const incidentId = value(incident.sys_id)
        const note = (commentDrafts[incidentId] || '').trim()
        if (!incidentId || !note) {
            return
        }

        if (!isOnline) {
            enqueueMutation({
                id: `${Date.now()}-${Math.random()}`,
                type: 'addWorkNote',
                incidentId,
                note,
            })
            setCommentDrafts((previous) => ({ ...previous, [incidentId]: '' }))
            setActiveCommentId('')
            setSuccess(messages.offlineCommentQueued)
            return
        }

        setUpdatingId(incidentId)
        setError('')
        try {
            await incidentService.addWorkNote(incident, note)
            setCommentDrafts((previous) => ({ ...previous, [incidentId]: '' }))
            setActiveCommentId('')
        } catch (caughtError) {
            console.error(caughtError)
            if (isNetworkError(caughtError)) {
                enqueueMutation({
                    id: `${Date.now()}-${Math.random()}`,
                    type: 'addWorkNote',
                    incidentId,
                    note,
                })
                setCommentDrafts((previous) => ({ ...previous, [incidentId]: '' }))
                setActiveCommentId('')
                setSuccess(messages.connectionLostCommentQueued)
            } else {
                setError((caughtError as Error).message || messages.couldNotSaveComment)
            }
        } finally {
            setUpdatingId('')
        }
    }

    const submitReportIssue = async (formData: ReportIssuePayload) => {
        if (!hasLoadedFromServer) {
            setError(messages.connectOnlineFirst)
            return
        }

        if (!isOnline) {
            enqueueMutation({
                id: `${Date.now()}-${Math.random()}`,
                type: 'createIncident',
                payload: formData,
            })
            setShowReportForm(false)
            setSuccess('')
            setToastMessage(messages.offlineNewIncidentQueued)
            return
        }

        setError('')
        setSuccess('')
        setLoading(true)
        try {
            const created = await incidentService.createIncident(formData)
            markReportedIncident(value(created.sys_id))
            const ticketNumber = display(created.number, messages.incident)
            setSuccess('')
            setToastMessage(messages.incidentSubmittedSuccessfully(ticketNumber))
            setShowReportForm(false)
            await refreshIncidents()
        } catch (caughtError) {
            console.error(caughtError)
            if (isNetworkError(caughtError)) {
                enqueueMutation({
                    id: `${Date.now()}-${Math.random()}`,
                    type: 'createIncident',
                    payload: formData,
                })
                setShowReportForm(false)
                setSuccess('')
                setToastMessage(messages.connectionLostNewIncidentQueued)
            } else {
                setError((caughtError as Error).message || messages.couldNotSubmitIncident)
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="incident-mobile-app">
            <header className="hero-header">
                <div className="hero-brand">
                    <div className="hero-logo" aria-hidden="true">
                        IW
                    </div>
                    <div className="hero-brand-text">
                        <p className="hero-kicker">{messages.serviceOperations}</p>
                        <h1>{messages.incidentWorkflow}</h1>
                    </div>
                </div>
                <div className="hero-user-block">
                    <strong>{profileLabel}</strong>
                    <span>{messages.headerTaskSummary(headerSummary.openCount, headerSummary.estimateLabel)}</span>
                    <span>{messages.nextLabel(headerSummary.nextWorkLabel)}</span>
                </div>
            </header>

            <header className="app-top-header">
                <div>
                    <p className="muted-label">{messages.myAssignedIncidents}</p>
                </div>
                <button className="refresh-button" onClick={() => void refreshIncidents()} disabled={loading}>
                    {messages.refresh}
                </button>
            </header>

            <section className="search-row">
                <input
                    className="search-input"
                    placeholder={messages.searchPlaceholder}
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                />
                <select
                    className="search-filter"
                    value={completionFilter}
                    onChange={(event) => setCompletionFilter(event.target.value as 'all' | 'open' | 'completed')}
                    aria-label={messages.filterIncidentsAriaLabel}
                >
                    <option value="all">{messages.all}</option>
                    <option value="open">{messages.open}</option>
                    <option value="completed">{messages.completed}</option>
                </select>
                <button className="report-button" type="button" onClick={() => setShowReportForm(true)}>
                    {messages.reportIssue}
                </button>
            </section>

            <section className="stats-row">
                <div className="stat-item">{`${stats.complete} ${messages.complete}`}</div>
                <div className="stat-item">{`${stats.inProgress} ${messages.inProgress}`}</div>
                <div className="stat-item">{`${stats.onHold} ${messages.onHold}`}</div>
                <div className="stat-item">{`${stats.remaining} ${messages.remaining}`}</div>
            </section>

            {!isOnline && <div className="offline-banner">{messages.offlineModeBanner}</div>}
            {pendingSyncCount > 0 && (
                <div className="pending-sync-banner">{messages.queuedChangesPending(pendingSyncCount)}</div>
            )}
            {inactivityRemainingSeconds !== null && (
                <div className="inactivity-banner" role="alert">
                    {messages.inactivityWarning(inactivityRemainingSeconds)}{' '}
                    <button
                        type="button"
                        className="inactivity-stay-button"
                        onClick={() => {
                            inactivityResetRef.current()
                        }}
                    >
                        {messages.staySignedIn}
                    </button>
                </div>
            )}
            {error && <div className="error-banner">{error}</div>}
            {success && <div className="success-banner">{success}</div>}
            {loading && <div className="loading-banner">{messages.loadingAssignedIncidents}</div>}
            {toastMessage && (
                <div className="toast-notice" role="status" aria-live="polite">
                    {toastMessage}
                </div>
            )}

            <main className="incident-list-cards">
                {!loading && visibleIncidents.length === 0 && <p className="empty-state">{messages.noAssignedIncidentsFound}</p>}

                {visibleIncidents.map((incident) => {
                    const incidentId = value(incident.sys_id)
                    const state = value(incident.state)
                    const actions = getActionsForState(state)
                    const isExpanded = Boolean(expanded[incidentId])
                    const startedAt = inProgressSince[incidentId]
                    const elapsedSeconds = startedAt ? (nowMs - startedAt) / 1000 : 0
                    const progress = Math.min(100, Math.round((elapsedSeconds / (DEFAULT_ESTIMATE_MINUTES * 60)) * 100))

                    return (
                        <article className="incident-card" key={incidentId}>
                            <button
                                className="expand-toggle"
                                type="button"
                                onClick={() =>
                                    setExpanded((previous) => ({
                                        ...previous,
                                        [incidentId]: !previous[incidentId],
                                    }))
                                }
                            >
                                <span>
                                    <strong>{display(incident.number, messages.incident)}</strong>
                                    <span className="subtitle">{display(incident.short_description, messages.noSummary)}</span>
                                </span>
                                <span>{isExpanded ? messages.hide : messages.show}</span>
                            </button>

                            <p className="incident-meta">{`${messages.state}: ${messages.stateLabels[state] || display(incident.state, messages.new)}`}</p>
                            <p className="incident-meta">{`${messages.assignedTo}: ${display(incident.assigned_to, messages.currentUser)}`}</p>
                            <p className="incident-meta">{`${messages.due}: ${formatDate(display(incident.due_date) || display(incident.opened_at), locale, messages.noDate)}`}</p>

                            {state === '2' && (
                                <>
                                    <div className="timer-chip">{messages.timerEstimate(formatDuration(elapsedSeconds), DEFAULT_ESTIMATE_MINUTES)}</div>
                                    <div className="timer-track">
                                        <div className="timer-progress" style={{ width: `${progress}%` }} />
                                    </div>
                                </>
                            )}

                            <div className="actions-panel">
                                {actions.map((action) => (
                                    <button
                                        className={`action-button action-${action.tone}`}
                                        key={action.id}
                                        onClick={() => {
                                            if (action.id === 'complete') {
                                                setActiveResolveId((previous) => (previous === incidentId ? '' : incidentId))
                                                return
                                            }
                                            void transitionIncident(incident, action.nextState)
                                        }}
                                        disabled={updatingId === incidentId}
                                    >
                                        {messages.actionLabels[action.id]}
                                    </button>
                                ))}
                                <button
                                    className="action-button action-neutral"
                                    type="button"
                                    onClick={() => setActiveCommentId((previous) => (previous === incidentId ? '' : incidentId))}
                                >
                                    {messages.comments}
                                </button>
                            </div>

                            {activeCommentId === incidentId && (
                                <div className="comment-panel">
                                    <textarea
                                        className="comment-input"
                                        value={commentDrafts[incidentId] || ''}
                                        onChange={(event) =>
                                            setCommentDrafts((previous) => ({ ...previous, [incidentId]: event.target.value }))
                                        }
                                        placeholder={messages.addWorkNotesPlaceholder}
                                        rows={3}
                                    />
                                    <button
                                        type="button"
                                        className="action-button action-primary"
                                        onClick={() => void submitComment(incident)}
                                        disabled={updatingId === incidentId || !(commentDrafts[incidentId] || '').trim()}
                                    >
                                        {messages.saveComment}
                                    </button>
                                </div>
                            )}

                            {activeResolveId === incidentId && (
                                <div className="resolve-panel">
                                    <label className="resolve-label" htmlFor={`resolution-code-${incidentId}`}>
                                        {messages.resolutionCode}
                                    </label>
                                    <select
                                        id={`resolution-code-${incidentId}`}
                                        className="resolve-select"
                                        value={resolveDrafts[incidentId]?.code || ''}
                                        onChange={(event) =>
                                            setResolveDrafts((previous) => ({
                                                ...previous,
                                                [incidentId]: {
                                                    code: event.target.value,
                                                    notes: previous[incidentId]?.notes || '',
                                                },
                                            }))
                                        }
                                    >
                                        <option value="">{messages.selectResolutionCode}</option>
                                        {closeCodeOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>

                                    <label className="resolve-label" htmlFor={`close-notes-${incidentId}`}>
                                        {messages.closeNotes}
                                    </label>
                                    <textarea
                                        id={`close-notes-${incidentId}`}
                                        className="comment-input"
                                        value={resolveDrafts[incidentId]?.notes || ''}
                                        onChange={(event) =>
                                            setResolveDrafts((previous) => ({
                                                ...previous,
                                                [incidentId]: {
                                                    code: previous[incidentId]?.code || '',
                                                    notes: event.target.value,
                                                },
                                            }))
                                        }
                                        placeholder={messages.addCloseNotesPlaceholder}
                                        rows={3}
                                    />
                                    <button
                                        type="button"
                                        className="action-button action-primary"
                                        onClick={() => void submitCompletion(incident)}
                                        disabled={
                                            updatingId === incidentId ||
                                            !(resolveDrafts[incidentId]?.code || '').trim() ||
                                            !(resolveDrafts[incidentId]?.notes || '').trim()
                                        }
                                    >
                                        {messages.saveAndComplete}
                                    </button>
                                </div>
                            )}

                            {isExpanded && (
                                <div className="expanded-details">
                                    <p>
                                        <strong>{`${messages.priority}:`}</strong> {display(incident.priority, messages.notSet)}
                                    </p>
                                    <p>
                                        <strong>{`${messages.location}:`}</strong> {display(incident.location, messages.notSet)}
                                    </p>
                                    <p>
                                        <strong>{`${messages.description}:`}</strong> {display(incident.description, messages.noDetailsProvided)}
                                    </p>
                                </div>
                            )}
                        </article>
                    )
                })}
            </main>

            {showReportForm && (
                <IncidentForm
                    messages={messages.form}
                    onCancel={() => setShowReportForm(false)}
                    onSubmit={(data) => {
                        void submitReportIssue(data)
                    }}
                />
            )}

            <footer className="mobile-nav">
                <span className="mobile-nav-item" aria-label={profileLabel}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="12" cy="8" r="4" />
                        <path d="M4 20c0-3.5 3.6-6 8-6s8 2.5 8 6" />
                    </svg>
                    <span className="mobile-nav-label">{compactProfileLabel}</span>
                </span>
                <span className="mobile-nav-item">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                    <span className="mobile-nav-label">{messages.orders}</span>
                </span>
                <button
                    type="button"
                    className="mobile-nav-item mobile-nav-button"
                    onClick={() => setShowLanguageMenu((previous) => !previous)}
                    aria-expanded={showLanguageMenu}
                    aria-label={messages.language}
                >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
                    </svg>
                    <span className="mobile-nav-label">{languageLabel}</span>
                </button>
                <button type="button" className="mobile-nav-item mobile-nav-button" onClick={logoutUser}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M10 7V4h10v16H10v-3M14 12H4m0 0 3-3m-3 3 3 3" />
                    </svg>
                    <span className="mobile-nav-label">{messages.logout}</span>
                </button>
            </footer>
            {showLanguageMenu && (
                <div className="language-menu">
                    <label htmlFor="language-selector">{messages.language}</label>
                    <select
                        id="language-selector"
                        value={language}
                        onChange={(event) => {
                            setLanguage(event.target.value as LanguageCode)
                            setShowLanguageMenu(false)
                        }}
                    >
                        {LANGUAGE_OPTIONS.map((option) => (
                            <option key={option.code} value={option.code}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>
            )}
        </div>
    )
}
