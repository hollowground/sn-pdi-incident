import React from 'react'
import './IncidentList.css'
import { IncidentRecord, ServiceNowField } from '../services/IncidentService'

type IncidentListProps = {
    incidents: IncidentRecord[]
    onEdit: (incident: IncidentRecord) => void
    onRefresh: () => void
    service: { delete: (sysId: string) => Promise<unknown> }
}

function fieldDisplay(field?: string | ServiceNowField, fallback = '') {
    if (!field) {
        return fallback
    }
    if (typeof field === 'string') {
        return field
    }
    return field.display_value || field.value || fallback
}

function fieldValue(field?: string | ServiceNowField) {
    if (!field) {
        return ''
    }
    if (typeof field === 'string') {
        return field
    }
    return field.value || ''
}

export default function IncidentList({ incidents, onEdit, onRefresh, service }: IncidentListProps) {
    const handleDelete = async (incident: IncidentRecord) => {
        if (!confirm(`Are you sure you want to delete ${fieldDisplay(incident.number, 'this incident')}?`)) {
            return
        }

        try {
            const sysId = fieldValue(incident.sys_id)
            await service.delete(sysId)
            onRefresh()
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error'
            console.error('Failed to delete incident:', error)
            alert(`Failed to delete incident: ${message}`)
        }
    }

    const getStateClass = (state?: string | ServiceNowField) => {
        const stateValue = fieldDisplay(state)

        switch (stateValue) {
            case 'New':
                return 'state-new'
            case 'In Progress':
                return 'state-in-progress'
            case 'On Hold':
                return 'state-on-hold'
            case 'Resolved':
                return 'state-resolved'
            case 'Closed':
                return 'state-closed'
            default:
                return ''
        }
    }

    const getImpactClass = (impact?: string | ServiceNowField) => {
        const impactValue = fieldValue(impact)

        switch (impactValue) {
            case '1':
                return 'impact-high'
            case '2':
                return 'impact-medium'
            case '3':
                return 'impact-low'
            default:
                return ''
        }
    }

    return (
        <div className="incident-list">
            {incidents.length === 0 ? (
                <div className="no-incidents">No incidents found</div>
            ) : (
                <table>
                    <thead>
                        <tr>
                            <th>Number</th>
                            <th>Description</th>
                            <th>State</th>
                            <th>Impact</th>
                            <th>Opened</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {incidents.map((incident) => {
                            const number = fieldDisplay(incident.number)
                            const shortDesc = fieldDisplay(incident.short_description)
                            const state = fieldDisplay(incident.state)
                            const impact = fieldDisplay(incident.impact)
                            const openedAt = fieldDisplay(incident.opened_at)

                            return (
                                <tr key={fieldValue(incident.sys_id)}>
                                    <td>{number}</td>
                                    <td>{shortDesc}</td>
                                    <td>
                                        <span className={`state-badge ${getStateClass(incident.state)}`}>{state}</span>
                                    </td>
                                    <td>
                                        <span className={`impact-badge ${getImpactClass(incident.impact)}`}>
                                            {impact}
                                        </span>
                                    </td>
                                    <td>{openedAt}</td>
                                    <td>
                                        <div className="action-buttons">
                                            <button
                                                className="edit-button"
                                                onClick={() => onEdit(incident)}
                                                aria-label={`Edit incident ${number}`}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                className="delete-button"
                                                onClick={() => handleDelete(incident)}
                                                aria-label={`Delete incident ${number}`}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            )}
        </div>
    )
}
