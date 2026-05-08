import type { IncidentFormMessages } from '../components/IncidentForm'

export const LANGUAGE_OPTIONS = [
    { code: 'en', label: 'English', locale: 'en-US' },
    { code: 'es', label: 'Espanol', locale: 'es-ES' },
    { code: 'fr', label: 'Francais', locale: 'fr-FR' },
] as const

export type LanguageCode = (typeof LANGUAGE_OPTIONS)[number]['code']
export type ActionId = 'start' | 'pause' | 'complete' | 'incomplete' | 'resume'

export type Messages = {
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

export const MESSAGES_BY_LANGUAGE: Record<LanguageCode, Messages> = {
    en: EN_MESSAGES,
    es: ES_MESSAGES,
    fr: FR_MESSAGES,
}
