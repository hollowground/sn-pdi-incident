import type { IncidentStateValue } from '../services/IncidentService'
import type { ActionId } from '../i18n/messages'

export type ActionDefinition = { id: ActionId; nextState: IncidentStateValue; tone: string }

export function getActionsForState(state: string): ActionDefinition[] {
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
