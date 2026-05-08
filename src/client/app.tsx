import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './app.css'
import IncidentForm, { type IncidentFormMessages } from './components/IncidentForm'
import {
    IncidentRecord,
    IncidentService,
    display,
    value,
    type ChoiceOption,
    type IncidentStateValue,
} from './services/IncidentService'

const DEFAULT_ESTIMATE_MINUTES = 15
const INCIDENT_CACHE_KEY = 'incident-workflow-cache-v1'
const PENDING_MUTATIONS_KEY = 'incident-workflow-pending-v1'
const REPORTED_INCIDENT_IDS_KEY = 'incident-workflow-reported-v1'
const LANGUAGE_STORAGE_KEY = 'incident-workflow-language-v1'
const LANGUAGE_OPTIONS = [
    { code: 'en', label: 'English', locale: 'en-US' },
    { code: 'es', label: 'Espanol', locale: 'es-ES' },
    { code: 'fr', label: 'Francais', locale: 'fr-FR' },
] as const

type LanguageCode = (typeof LANGUAGE_OPTIONS)[number]['code']
type ActionId = 'start' | 'pause' | 'complete' | 'incomplete' | 'resume'
type ActionDefinition = { id: ActionId; nextState: IncidentStateValue; tone: string }
type Messages = {
    serviceOperations: string
    incidentWorkflow: string
    myAssignedIncidents: string
    refresh: string
    searchPlaceholder: string
    filterIncidentsAriaLabel: string
    all: string
    open: string
    completed: string
    reportIssue: string
    complete: string
    inProgress: string
    onHold: string
    remaining: string
    offlineModeBanner: string
    queuedChangesPending: (count: number) => string
    loadingAssignedIncidents: string
    noAssignedIncidentsFound: string
    hide: string
    show: string
    state: string
    assignedTo: string
    due: string
    comments: string
    addWorkNotesPlaceholder: string
    saveComment: string
    resolutionCode: string
    selectResolutionCode: string
    closeNotes: string
    addCloseNotesPlaceholder: string
    saveAndComplete: string
    priority: string
    location: string
    description: string
    notSet: string
    noDetailsProvided: string
    orders: string
    language: string
    logout: string
    profile: string
    currentUser: string
    incident: string
    noSummary: string
    new: string
    noDate: string
    noUpcomingDueTime: string
    noOpenItems: string
    headerTaskSummary: (openCount: number, estimateLabel: string) => string
    nextLabel: (text: string) => string
    timerEstimate: (elapsed: string, minutes: number) => string
    newIncidentAssigned: (ticket: string) => string
    newIncidentsAssigned: (count: number) => string
    failedToLoadIncidents: string
    couldNotSyncOfflineUpdates: string
    syncedOfflineChanges: (count: number) => string
    offlineIncidentUpdateQueued: string
    connectionLostIncidentUpdateQueued: string
    couldNotUpdateIncidentState: string
    offlineCommentQueued: string
    connectionLostCommentQueued: string
    couldNotSaveComment: string
    connectOnlineFirst: string
    offlineNewIncidentQueued: string
    incidentSubmittedSuccessfully: (ticket: string) => string
    connectionLostNewIncidentQueued: string
    couldNotSubmitIncident: string
    completionMotivationTemplates: Array<(name: string) => string>
    stateLabels: Record<string, string>
    actionLabels: Record<ActionId, string>
    form: IncidentFormMessages
}

const EN_MESSAGES: Messages = {
    serviceOperations: 'Service Operations',
    incidentWorkflow: 'Incident Workflow',
    myAssignedIncidents: 'My Assigned Incidents',
    refresh: 'Refresh',
    searchPlaceholder: 'Search incidents by number, summary, or location',
    filterIncidentsAriaLabel: 'Filter incidents by completion status',
    all: 'All',
    open: 'Open',
    completed: 'Completed',
    reportIssue: 'Report Issue',
    complete: 'Complete',
    inProgress: 'In Progress',
    onHold: 'On Hold',
    remaining: 'Remaining',
    offlineModeBanner: 'Offline mode: changes are queued and will sync when online.',
    queuedChangesPending: (count) => `${count} queued change${count === 1 ? '' : 's'} pending sync.`,
    loadingAssignedIncidents: 'Loading assigned incidents...',
    noAssignedIncidentsFound: 'No assigned incidents found.',
    hide: 'Hide',
    show: 'Show',
    state: 'State',
    assignedTo: 'Assigned to',
    due: 'Due',
    comments: 'Comments',
    addWorkNotesPlaceholder: 'Add work notes...',
    saveComment: 'Save Comment',
    resolutionCode: 'Resolution code',
    selectResolutionCode: 'Select resolution code',
    closeNotes: 'Close notes',
    addCloseNotesPlaceholder: 'Add close notes...',
    saveAndComplete: 'Save And Complete',
    priority: 'Priority',
    location: 'Location',
    description: 'Description',
    notSet: 'Not set',
    noDetailsProvided: 'No details provided',
    orders: 'Orders',
    language: 'Language',
    logout: 'Logout',
    profile: 'Profile',
    currentUser: 'Current User',
    incident: 'Incident',
    noSummary: 'No summary',
    new: 'New',
    noDate: 'No date',
    noUpcomingDueTime: 'No upcoming due time',
    noOpenItems: 'No open items',
    headerTaskSummary: (openCount, estimateLabel) => `${openCount} Tasks Today Est ${estimateLabel} Complete`,
    nextLabel: (text) => `Next: ${text}`,
    timerEstimate: (elapsed, minutes) => `${elapsed} / ${minutes} min est.`,
    newIncidentAssigned: (ticket) => `New incident assigned: ${ticket}`,
    newIncidentsAssigned: (count) => `${count} new incidents assigned to you.`,
    failedToLoadIncidents: 'Failed to load incidents.',
    couldNotSyncOfflineUpdates: 'Could not sync offline updates.',
    syncedOfflineChanges: (count) => `Synced ${count} offline change${count === 1 ? '' : 's'}.`,
    offlineIncidentUpdateQueued: 'You are offline. Incident update queued and will sync automatically.',
    connectionLostIncidentUpdateQueued: 'Connection lost. Incident update queued and will sync automatically.',
    couldNotUpdateIncidentState: 'Could not update incident state.',
    offlineCommentQueued: 'You are offline. Comment queued and will sync automatically.',
    connectionLostCommentQueued: 'Connection lost. Comment queued and will sync automatically.',
    couldNotSaveComment: 'Could not save comment.',
    connectOnlineFirst: 'Connect once online to load incidents before using offline mode.',
    offlineNewIncidentQueued: 'You are offline. New incident report queued and will sync automatically.',
    incidentSubmittedSuccessfully: (ticket) => `${ticket} was submitted successfully.`,
    connectionLostNewIncidentQueued: 'Connection lost. New incident report queued and will sync automatically.',
    couldNotSubmitIncident: 'Could not submit incident.',
    completionMotivationTemplates: [
        (name) => `Nice job resolving another case, ${name}!`,
        (name) => `Great work, ${name}. Another incident is complete.`,
        (name) => `${name}, you closed that one out like a pro.`,
        (name) => `Strong finish, ${name}. Keep it moving.`,
        (name) => `Excellent progress, ${name}. One more down.`,
        (name) => `${name}, your momentum is impressive. Incident complete.`,
        (name) => `Way to go, ${name}! That incident is fully wrapped.`,
        (name) => `${name}, another win for the queue. Nicely done.`,
        (name) => `Outstanding execution, ${name}. Case closed.`,
        (name) => `You are on fire, ${name}. Another incident resolved.`,
    ],
    stateLabels: {
        '1': 'Ready for Work',
        '2': 'In Progress',
        '3': 'On Hold',
        '6': 'Complete',
        '7': 'Closed',
    },
    actionLabels: {
        start: 'Start',
        pause: 'Pause',
        complete: 'Complete',
        incomplete: 'Incomplete',
        resume: 'Resume',
    },
    form: {
        incidentFallbackLabel: 'Incident',
        headingEditPrefix: 'Edit',
        headingReportNew: 'Report New Incident',
        shortDescriptionLabel: 'Short Description *',
        descriptionLabel: 'Description',
        impactLabel: 'Impact',
        urgencyLabel: 'Urgency',
        impactHigh: 'High',
        impactMedium: 'Medium',
        impactLow: 'Low',
        cancelButton: 'Cancel',
        updateButton: 'Update',
        submitIncidentButton: 'Submit Incident',
        scanQrButton: 'Scan QR',
        scanStatusSuccess: 'QR code scanned. Fields updated.',
        scanErrorSecureContext: 'Camera access requires HTTPS or localhost.',
        scanErrorNoCameraSupport: 'This browser does not support camera capture.',
        scanErrorStart: 'Unable to start scanner. Check camera permissions and try again.',
        scannerDialogAria: 'Scan QR code',
        scannerTitle: 'Scan QR Code',
        scannerHint: 'Point your camera at a QR code to auto-fill the form.',
        closeButton: 'Close',
    },
}

const ES_MESSAGES: Messages = {
    ...EN_MESSAGES,
    serviceOperations: 'Operaciones de Servicio',
    incidentWorkflow: 'Flujo de Incidentes',
    myAssignedIncidents: 'Mis Incidentes Asignados',
    refresh: 'Actualizar',
    searchPlaceholder: 'Buscar incidentes por numero, resumen o ubicacion',
    filterIncidentsAriaLabel: 'Filtrar incidentes por estado de finalizacion',
    all: 'Todos',
    open: 'Abiertos',
    completed: 'Completados',
    reportIssue: 'Reportar Incidente',
    complete: 'Completados',
    inProgress: 'En Progreso',
    onHold: 'En Espera',
    remaining: 'Restantes',
    offlineModeBanner: 'Modo sin conexion: los cambios se guardan y se sincronizan al volver en linea.',
    loadingAssignedIncidents: 'Cargando incidentes asignados...',
    noAssignedIncidentsFound: 'No se encontraron incidentes asignados.',
    hide: 'Ocultar',
    show: 'Mostrar',
    state: 'Estado',
    assignedTo: 'Asignado a',
    due: 'Vence',
    comments: 'Comentarios',
    addWorkNotesPlaceholder: 'Agregar notas de trabajo...',
    saveComment: 'Guardar Comentario',
    resolutionCode: 'Codigo de resolucion',
    selectResolutionCode: 'Seleccionar codigo de resolucion',
    closeNotes: 'Notas de cierre',
    addCloseNotesPlaceholder: 'Agregar notas de cierre...',
    saveAndComplete: 'Guardar y Completar',
    priority: 'Prioridad',
    location: 'Ubicacion',
    notSet: 'No definido',
    noDetailsProvided: 'Sin detalles',
    orders: 'Ordenes',
    language: 'Idioma',
    logout: 'Cerrar sesion',
    profile: 'Perfil',
    currentUser: 'Usuario Actual',
    noSummary: 'Sin resumen',
    new: 'Nuevo',
    noDate: 'Sin fecha',
    noUpcomingDueTime: 'Sin proximo vencimiento',
    noOpenItems: 'Sin elementos abiertos',
    headerTaskSummary: (openCount, estimateLabel) => `${openCount} tareas hoy, estimado ${estimateLabel}`,
    nextLabel: (text) => `Siguiente: ${text}`,
    timerEstimate: (elapsed, minutes) => `${elapsed} / ${minutes} min est.`,
    newIncidentAssigned: (ticket) => `Nuevo incidente asignado: ${ticket}`,
    newIncidentsAssigned: (count) => `${count} incidentes nuevos asignados.`,
    failedToLoadIncidents: 'No se pudieron cargar los incidentes.',
    couldNotSyncOfflineUpdates: 'No se pudieron sincronizar los cambios sin conexion.',
    syncedOfflineChanges: (count) => `Se sincronizaron ${count} cambio${count === 1 ? '' : 's'} sin conexion.`,
    offlineIncidentUpdateQueued: 'Sin conexion. El cambio del incidente se pondra en cola.',
    connectionLostIncidentUpdateQueued: 'Se perdio la conexion. El cambio del incidente se pondra en cola.',
    couldNotUpdateIncidentState: 'No se pudo actualizar el estado del incidente.',
    offlineCommentQueued: 'Sin conexion. El comentario se pondra en cola.',
    connectionLostCommentQueued: 'Se perdio la conexion. El comentario se pondra en cola.',
    couldNotSaveComment: 'No se pudo guardar el comentario.',
    connectOnlineFirst: 'Conectate en linea al menos una vez antes de usar modo sin conexion.',
    offlineNewIncidentQueued: 'Sin conexion. El nuevo incidente se pondra en cola.',
    incidentSubmittedSuccessfully: (ticket) => `${ticket} se envio correctamente.`,
    connectionLostNewIncidentQueued: 'Se perdio la conexion. El nuevo incidente se pondra en cola.',
    couldNotSubmitIncident: 'No se pudo enviar el incidente.',
    completionMotivationTemplates: EN_MESSAGES.completionMotivationTemplates,
    stateLabels: {
        '1': 'Listo para Trabajar',
        '2': 'En Progreso',
        '3': 'En Espera',
        '6': 'Completado',
        '7': 'Cerrado',
    },
    actionLabels: {
        start: 'Iniciar',
        pause: 'Pausar',
        complete: 'Completar',
        incomplete: 'Incompleto',
        resume: 'Reanudar',
    },
    form: {
        ...EN_MESSAGES.form,
        headingEditPrefix: 'Editar',
        headingReportNew: 'Reportar Nuevo Incidente',
        shortDescriptionLabel: 'Descripcion corta *',
        descriptionLabel: 'Descripcion',
        impactLabel: 'Impacto',
        urgencyLabel: 'Urgencia',
        cancelButton: 'Cancelar',
        updateButton: 'Actualizar',
        submitIncidentButton: 'Enviar Incidente',
        scanStatusSuccess: 'Codigo QR escaneado. Campos actualizados.',
        scanErrorStart: 'No se pudo iniciar el escaner. Revisa permisos de camara.',
        scannerTitle: 'Escanear Codigo QR',
        scannerHint: 'Apunta la camara a un codigo QR para completar el formulario.',
        closeButton: 'Cerrar',
    },
}

const FR_MESSAGES: Messages = {
    ...EN_MESSAGES,
    serviceOperations: 'Operations de Service',
    incidentWorkflow: 'Flux des Incidents',
    myAssignedIncidents: 'Mes Incidents Assignes',
    refresh: 'Actualiser',
    searchPlaceholder: 'Rechercher par numero, resume ou emplacement',
    filterIncidentsAriaLabel: 'Filtrer les incidents par statut',
    all: 'Tous',
    open: 'Ouverts',
    completed: 'Termines',
    reportIssue: 'Signaler Incident',
    complete: 'Termines',
    inProgress: 'En Cours',
    onHold: 'En Attente',
    remaining: 'Restants',
    offlineModeBanner: 'Mode hors ligne: les changements sont mis en file et synchronises au retour en ligne.',
    loadingAssignedIncidents: 'Chargement des incidents assignes...',
    noAssignedIncidentsFound: 'Aucun incident assigne.',
    hide: 'Masquer',
    show: 'Afficher',
    state: 'Etat',
    assignedTo: 'Assigne a',
    due: 'Echeance',
    comments: 'Commentaires',
    addWorkNotesPlaceholder: 'Ajouter des notes...',
    saveComment: 'Enregistrer Commentaire',
    resolutionCode: 'Code de resolution',
    selectResolutionCode: 'Selectionner code de resolution',
    closeNotes: 'Notes de cloture',
    addCloseNotesPlaceholder: 'Ajouter des notes de cloture...',
    saveAndComplete: 'Enregistrer et Terminer',
    priority: 'Priorite',
    location: 'Emplacement',
    notSet: 'Non defini',
    noDetailsProvided: 'Aucun detail',
    orders: 'Commandes',
    language: 'Langue',
    logout: 'Deconnexion',
    profile: 'Profil',
    currentUser: 'Utilisateur Actuel',
    noSummary: 'Sans resume',
    new: 'Nouveau',
    noDate: 'Pas de date',
    noUpcomingDueTime: 'Aucune echeance a venir',
    noOpenItems: 'Aucun element ouvert',
    headerTaskSummary: (openCount, estimateLabel) => `${openCount} taches aujourd'hui, estimation ${estimateLabel}`,
    nextLabel: (text) => `Suivant: ${text}`,
    timerEstimate: (elapsed, minutes) => `${elapsed} / ${minutes} min estimees`,
    newIncidentAssigned: (ticket) => `Nouvel incident assigne: ${ticket}`,
    newIncidentsAssigned: (count) => `${count} nouveaux incidents assignes.`,
    failedToLoadIncidents: "Echec du chargement des incidents.",
    couldNotSyncOfflineUpdates: 'Impossible de synchroniser les changements hors ligne.',
    syncedOfflineChanges: (count) => `${count} changement${count === 1 ? '' : 's'} hors ligne synchronise(s).`,
    offlineIncidentUpdateQueued: "Hors ligne. La mise a jour de l'incident est mise en file.",
    connectionLostIncidentUpdateQueued: "Connexion perdue. La mise a jour de l'incident est mise en file.",
    couldNotUpdateIncidentState: "Impossible de mettre a jour l'etat de l'incident.",
    offlineCommentQueued: 'Hors ligne. Le commentaire est mis en file.',
    connectionLostCommentQueued: 'Connexion perdue. Le commentaire est mis en file.',
    couldNotSaveComment: 'Impossible de sauvegarder le commentaire.',
    connectOnlineFirst: 'Connectez-vous une fois en ligne avant le mode hors ligne.',
    offlineNewIncidentQueued: 'Hors ligne. Le nouvel incident est mis en file.',
    incidentSubmittedSuccessfully: (ticket) => `${ticket} a ete soumis avec succes.`,
    connectionLostNewIncidentQueued: 'Connexion perdue. Le nouvel incident est mis en file.',
    couldNotSubmitIncident: "Impossible d'envoyer l'incident.",
    completionMotivationTemplates: EN_MESSAGES.completionMotivationTemplates,
    stateLabels: {
        '1': 'Pret a Travailler',
        '2': 'En Cours',
        '3': 'En Attente',
        '6': 'Termine',
        '7': 'Ferme',
    },
    actionLabels: {
        start: 'Demarrer',
        pause: 'Pause',
        complete: 'Terminer',
        incomplete: 'Incomplet',
        resume: 'Reprendre',
    },
    form: {
        ...EN_MESSAGES.form,
        headingEditPrefix: 'Modifier',
        headingReportNew: 'Signaler Nouvel Incident',
        shortDescriptionLabel: 'Description courte *',
        impactLabel: 'Impact',
        urgencyLabel: 'Urgence',
        cancelButton: 'Annuler',
        updateButton: 'Mettre a jour',
        submitIncidentButton: 'Soumettre Incident',
        scanStatusSuccess: 'QR scanne. Champs mis a jour.',
        scanErrorStart: 'Impossible de demarrer le scanner. Verifiez les permissions camera.',
        scannerTitle: 'Scanner Code QR',
        scannerHint: 'Pointez la camera vers un QR code pour remplir le formulaire.',
        closeButton: 'Fermer',
    },
}

const MESSAGES_BY_LANGUAGE: Record<LanguageCode, Messages> = {
    en: EN_MESSAGES,
    es: ES_MESSAGES,
    fr: FR_MESSAGES,
}

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

function resolveInitialLanguage(): LanguageCode {
    try {
        const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
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

function formatDate(input: string, locale: string, emptyLabel: string) {
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

function formatNextTime(input: string, locale: string, emptyLabel: string) {
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

function getActionsForState(state: string): ActionDefinition[] {
    if (state === '1') {
        return [{ id: 'start', nextState: '2', tone: 'primary' }]
    }
    if (state === '2') {
        return [
            { id: 'pause', nextState: '3', tone: 'warning' },
            { id: 'complete', nextState: '6', tone: 'primary' },
            { id: 'incomplete', nextState: '3', tone: 'danger' },
        ]
    }
    if (state === '3') {
        return [
            { id: 'resume', nextState: '2', tone: 'warning' },
            { id: 'complete', nextState: '6', tone: 'primary' },
            { id: 'incomplete', nextState: '3', tone: 'danger' },
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

function getMotivationName(profileLabel: string, fallbackProfileLabel: string) {
    const trimmed = profileLabel.trim()
    if (!trimmed || trimmed === fallbackProfileLabel) {
        return 'teammate'
    }
    const firstToken = trimmed.split(/\s+/)[0]
    return firstToken || 'teammate'
}

function buildCompletionMotivation(messages: Messages, profileLabel: string) {
    const templates = messages.completionMotivationTemplates
    if (!templates.length) {
        return ''
    }
    const name = getMotivationName(profileLabel, messages.profile)
    const index = Math.floor(Math.random() * templates.length)
    return templates[index](name)
}

export default function App() {
    const incidentService = useMemo(() => new IncidentService(), [])
    const [language, setLanguage] = useState<LanguageCode>(() => resolveInitialLanguage())
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
    const [profileLabel, setProfileLabel] = useState(EN_MESSAGES.profile)
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
    const messages = useMemo(() => MESSAGES_BY_LANGUAGE[language], [language])
    const locale = useMemo(
        () => LANGUAGE_OPTIONS.find((option) => option.code === language)?.locale || 'en-US',
        [language]
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
        try {
            window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
        } catch {
            // noop
        }
    }, [language])

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
                const cached = readJson<IncidentRecord[]>(INCIDENT_CACHE_KEY, [])
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
    const languageLabel = useMemo(
        () => LANGUAGE_OPTIONS.find((option) => option.code === language)?.label || 'English',
        [language]
    )
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
