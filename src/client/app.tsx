import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './app.css'
import IncidentForm from './components/IncidentForm'
import {
    IncidentRecord,
    IncidentService,
    display,
    value,
    type ChoiceOption,
    type IncidentStateValue,
} from './services/IncidentService'

const STATE_LABEL: Record<string, string> = {
    '1': 'Ready for Work',
    '2': 'In Progress',
    '3': 'On Hold',
    '6': 'Complete',
    '7': 'Closed',
}

const DEFAULT_ESTIMATE_MINUTES = 15
const INCIDENT_CACHE_KEY = 'incident-workflow-cache-v1'
const PENDING_MUTATIONS_KEY = 'incident-workflow-pending-v1'
const REPORTED_INCIDENT_IDS_KEY = 'incident-workflow-reported-v1'
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

function readJson<T>(key: string, fallback: T): T {
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

function writeJson<T>(key: string, value: T) {
    try {
        window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
        // noop
    }
}

function isNetworkError(error: unknown) {
    if (!(error instanceof Error)) {
        return false
    }
    const message = error.message.toLowerCase()
    return message.includes('failed to fetch') || message.includes('network')
}

function formatDuration(seconds: number) {
    const safeSeconds = Math.max(0, Math.floor(seconds))
    const hours = String(Math.floor(safeSeconds / 3600)).padStart(2, '0')
    const minutes = String(Math.floor((safeSeconds % 3600) / 60)).padStart(2, '0')
    const remaining = String(safeSeconds % 60).padStart(2, '0')
    return `${hours}:${minutes}:${remaining}`
}

function formatDate(input: string) {
    if (!input) {
        return 'No date'
    }

    const parsed = new Date(input)
    if (Number.isNaN(parsed.getTime())) {
        return input
    }

    return new Intl.DateTimeFormat('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(parsed)
}

function formatNextTime(input: string) {
    if (!input) {
        return 'No upcoming due time'
    }

    const parsed = new Date(input)
    if (Number.isNaN(parsed.getTime())) {
        return input
    }

    return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        month: '2-digit',
        day: '2-digit',
    }).format(parsed)
}

function getActionsForState(state: string): { label: string; nextState: IncidentStateValue; tone: string }[] {
    if (state === '1') {
        return [{ label: 'Start', nextState: '2', tone: 'primary' }]
    }
    if (state === '2') {
        return [
            { label: 'Pause', nextState: '3', tone: 'warning' },
            { label: 'Complete', nextState: '6', tone: 'primary' },
            { label: 'Incomplete', nextState: '3', tone: 'danger' },
        ]
    }
    if (state === '3') {
        return [
            { label: 'Resume', nextState: '2', tone: 'warning' },
            { label: 'Complete', nextState: '6', tone: 'primary' },
            { label: 'Incomplete', nextState: '3', tone: 'danger' },
        ]
    }
    return []
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
    const [profileLabel, setProfileLabel] = useState('Profile')
    const [completionFilter, setCompletionFilter] = useState<'all' | 'open' | 'completed'>('all')
    const [toastMessage, setToastMessage] = useState('')
    const seenIncidentIdsRef = useRef<Set<string> | null>(null)
    const syncInFlightRef = useRef(false)
    const [isOnline, setIsOnline] = useState(window.navigator.onLine)
    const [pendingSyncCount, setPendingSyncCount] = useState(0)
    const [hasLoadedFromServer, setHasLoadedFromServer] = useState(false)
    const [reportedIncidentIds, setReportedIncidentIds] = useState<string[]>(() =>
        readJson<string[]>(REPORTED_INCIDENT_IDS_KEY, [])
    )
    const shouldAutoRefresh = !updatingId && !activeResolveId && !activeCommentId && !showReportForm

    const getPendingMutations = useCallback(() => readJson<PendingMutation[]>(PENDING_MUTATIONS_KEY, []), [])
    const setPendingMutations = useCallback((next: PendingMutation[]) => {
        writeJson(PENDING_MUTATIONS_KEY, next)
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
            writeJson(REPORTED_INCIDENT_IDS_KEY, next)
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
            writeJson(INCIDENT_CACHE_KEY, data)
            setHasLoadedFromServer(true)
            const nextIds = new Set(data.map((incident) => value(incident.sys_id)).filter(Boolean))
            const previousIds = seenIncidentIdsRef.current
            if (previousIds) {
                const newlyAssigned = data.filter((incident) => !previousIds.has(value(incident.sys_id)))
                if (newlyAssigned.length === 1) {
                    setToastMessage(`New incident assigned: ${display(newlyAssigned[0].number, 'Incident')}`)
                } else if (newlyAssigned.length > 1) {
                    setToastMessage(`${newlyAssigned.length} new incidents assigned to you.`)
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
                const cached = readJson<IncidentRecord[]>(INCIDENT_CACHE_KEY, [])
                if (cached.length > 0) {
                    setIncidents(cached)
                }
            }
            setError((caughtError as Error).message || 'Failed to load incidents.')
        } finally {
            if (!silent) {
                setLoading(false)
            }
        }
    }, [incidentService, isOnline])

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
                    setError((caughtError as Error).message || 'Could not sync offline updates.')
                }
                break
            }
        }

        if (processed > 0) {
            setSuccess(`Synced ${processed} offline change${processed === 1 ? '' : 's'}.`)
            await refreshIncidents({ silent: true })
        }

        syncInFlightRef.current = false
    }, [getPendingMutations, incidentService, markReportedIncident, refreshIncidents, setPendingMutations])

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
        if (!toastMessage) {
            return
        }

        const timer = window.setTimeout(() => {
            setToastMessage('')
        }, 5000)

        return () => window.clearTimeout(timer)
    }, [toastMessage])

    useEffect(() => {
        if (profileLabel !== 'Profile' || incidents.length === 0) {
            return
        }

        const assignedName = display(incidents[0]?.assigned_to).trim()
        if (assignedName) {
            setProfileLabel(assignedName)
        }
    }, [incidents, profileLabel])

    useEffect(() => {
        const timer = window.setInterval(() => {
            setNowMs(Date.now())
        }, 1000)

        return () => window.clearInterval(timer)
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
        const nextNumber = nextIncident ? display(nextIncident.number, 'Incident') : ''
        const estimatedHours = ((openIncidents.length * DEFAULT_ESTIMATE_MINUTES) / 60).toFixed(1)

        return {
            openCount: openIncidents.length,
            estimateLabel: `${estimatedHours}h`,
            nextWorkLabel: nextIncident ? `${nextNumber} - ${formatNextTime(nextTimeRaw)}` : 'No open items',
        }
    }, [sortedWorkQueue])

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
            setSuccess('You are offline. Incident update queued and will sync automatically.')
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
                setSuccess('Connection lost. Incident update queued and will sync automatically.')
            } else {
                setError((caughtError as Error).message || 'Could not update incident state.')
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
            setSuccess('You are offline. Comment queued and will sync automatically.')
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
                setSuccess('Connection lost. Comment queued and will sync automatically.')
            } else {
                setError((caughtError as Error).message || 'Could not save comment.')
            }
        } finally {
            setUpdatingId('')
        }
    }

    const submitReportIssue = async (formData: ReportIssuePayload) => {
        if (!hasLoadedFromServer) {
            setError('Connect once online to load incidents before using offline mode.')
            return
        }

        if (!isOnline) {
            enqueueMutation({
                id: `${Date.now()}-${Math.random()}`,
                type: 'createIncident',
                payload: formData,
            })
            setShowReportForm(false)
            setSuccess('You are offline. New incident report queued and will sync automatically.')
            return
        }

        setError('')
        setSuccess('')
        setLoading(true)
        try {
            const created = await incidentService.createIncident(formData)
            markReportedIncident(value(created.sys_id))
            const ticketNumber = display(created.number, 'Incident')
            setSuccess(`${ticketNumber} was submitted successfully.`)
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
                setSuccess('Connection lost. New incident report queued and will sync automatically.')
            } else {
                setError((caughtError as Error).message || 'Could not submit incident.')
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
                        <p className="hero-kicker">Service Operations</p>
                        <h1>Incident Workflow</h1>
                    </div>
                </div>
                <div className="hero-user-block">
                    <strong>{profileLabel}</strong>
                    <span>{`${headerSummary.openCount} Tasks Today Est ${headerSummary.estimateLabel} Complete`}</span>
                    <span>{`Next: ${headerSummary.nextWorkLabel}`}</span>
                </div>
            </header>

            <header className="app-top-header">
                <div>
                    <p className="muted-label">My assigned incidents</p>
                </div>
                <button className="refresh-button" onClick={() => void refreshIncidents()} disabled={loading}>
                    Refresh
                </button>
            </header>

            <section className="search-row">
                <input
                    className="search-input"
                    placeholder="Search incidents by number, summary, or location"
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                />
                <select
                    className="search-filter"
                    value={completionFilter}
                    onChange={(event) => setCompletionFilter(event.target.value as 'all' | 'open' | 'completed')}
                    aria-label="Filter incidents by completion status"
                >
                    <option value="all">All</option>
                    <option value="open">Open</option>
                    <option value="completed">Completed</option>
                </select>
                <button className="report-button" type="button" onClick={() => setShowReportForm(true)}>
                    Report Issue
                </button>
            </section>

            <section className="stats-row">
                <div className="stat-item">{stats.complete} Complete</div>
                <div className="stat-item">{stats.inProgress} In Progress</div>
                <div className="stat-item">{stats.onHold} On Hold</div>
                <div className="stat-item">{stats.remaining} Remaining</div>
            </section>

            {!isOnline && <div className="offline-banner">Offline mode: changes are queued and will sync when online.</div>}
            {pendingSyncCount > 0 && (
                <div className="pending-sync-banner">{pendingSyncCount} queued change{pendingSyncCount === 1 ? '' : 's'} pending sync.</div>
            )}
            {error && <div className="error-banner">{error}</div>}
            {success && <div className="success-banner">{success}</div>}
            {loading && <div className="loading-banner">Loading assigned incidents...</div>}
            {toastMessage && (
                <div className="toast-notice" role="status" aria-live="polite">
                    {toastMessage}
                </div>
            )}

            <main className="incident-list-cards">
                {!loading && visibleIncidents.length === 0 && <p className="empty-state">No assigned incidents found.</p>}

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
                                    <strong>{display(incident.number, 'Incident')}</strong>
                                    <span className="subtitle">{display(incident.short_description, 'No summary')}</span>
                                </span>
                                <span>{isExpanded ? 'Hide' : 'Show'}</span>
                            </button>

                            <p className="incident-meta">State: {STATE_LABEL[state] || display(incident.state, 'New')}</p>
                            <p className="incident-meta">Assigned to: {display(incident.assigned_to, 'Current User')}</p>
                            <p className="incident-meta">Due: {formatDate(display(incident.due_date) || display(incident.opened_at))}</p>

                            {state === '2' && (
                                <>
                                    <div className="timer-chip">{`${formatDuration(elapsedSeconds)} / ${DEFAULT_ESTIMATE_MINUTES} min est.`}</div>
                                    <div className="timer-track">
                                        <div className="timer-progress" style={{ width: `${progress}%` }} />
                                    </div>
                                </>
                            )}

                            <div className="actions-panel">
                                {actions.map((action) => (
                                    <button
                                        className={`action-button action-${action.tone}`}
                                        key={action.label}
                                        onClick={() => {
                                            if (action.label === 'Complete') {
                                                setActiveResolveId((previous) => (previous === incidentId ? '' : incidentId))
                                                return
                                            }
                                            void transitionIncident(incident, action.nextState)
                                        }}
                                        disabled={updatingId === incidentId}
                                    >
                                        {action.label}
                                    </button>
                                ))}
                                <button
                                    className="action-button action-neutral"
                                    type="button"
                                    onClick={() => setActiveCommentId((previous) => (previous === incidentId ? '' : incidentId))}
                                >
                                    Comments
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
                                        placeholder="Add work notes..."
                                        rows={3}
                                    />
                                    <button
                                        type="button"
                                        className="action-button action-primary"
                                        onClick={() => void submitComment(incident)}
                                        disabled={updatingId === incidentId || !(commentDrafts[incidentId] || '').trim()}
                                    >
                                        Save Comment
                                    </button>
                                </div>
                            )}

                            {activeResolveId === incidentId && (
                                <div className="resolve-panel">
                                    <label className="resolve-label" htmlFor={`resolution-code-${incidentId}`}>
                                        Resolution code
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
                                        <option value="">Select resolution code</option>
                                        {closeCodeOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>

                                    <label className="resolve-label" htmlFor={`close-notes-${incidentId}`}>
                                        Close notes
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
                                        placeholder="Add close notes..."
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
                                        Save And Complete
                                    </button>
                                </div>
                            )}

                            {isExpanded && (
                                <div className="expanded-details">
                                    <p>
                                        <strong>Priority:</strong> {display(incident.priority, 'Not set')}
                                    </p>
                                    <p>
                                        <strong>Location:</strong> {display(incident.location, 'Not set')}
                                    </p>
                                    <p>
                                        <strong>Description:</strong> {display(incident.description, 'No details provided')}
                                    </p>
                                </div>
                            )}
                        </article>
                    )
                })}
            </main>

            {showReportForm && (
                <IncidentForm
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
                    <span className="mobile-nav-label">Orders</span>
                </span>
                <span className="mobile-nav-item">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
                    </svg>
                    <span className="mobile-nav-label">Language</span>
                </span>
                <button type="button" className="mobile-nav-item mobile-nav-button" onClick={logoutUser}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M10 7V4h10v16H10v-3M14 12H4m0 0 3-3m-3 3 3 3" />
                    </svg>
                    <span className="mobile-nav-label">Logout</span>
                </button>
            </footer>
        </div>
    )
}
