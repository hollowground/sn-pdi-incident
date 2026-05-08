export type IncidentStateValue = '1' | '2' | '3' | '6' | '7'
export interface ChoiceOption {
    value: string
    label: string
}

export interface ServiceNowField {
    value?: string
    display_value?: string
}

export interface IncidentRecord {
    sys_id: string | ServiceNowField
    number?: string | ServiceNowField
    short_description?: string | ServiceNowField
    description?: string | ServiceNowField
    caller_id?: string | ServiceNowField
    opened_by?: string | ServiceNowField
    state?: string | ServiceNowField
    impact?: string | ServiceNowField
    urgency?: string | ServiceNowField
    assigned_to?: string | ServiceNowField
    priority?: string | ServiceNowField
    u_work_location?: string | ServiceNowField
    location?: string | ServiceNowField
    due_date?: string | ServiceNowField
    opened_at?: string | ServiceNowField
    work_start?: string | ServiceNowField
    work_end?: string | ServiceNowField
}

interface SysChoiceRow {
    value?: string | ServiceNowField
    label?: string | ServiceNowField
}

declare global {
    interface Window {
        g_ck: string
        g_user?: {
            userID?: string
            userId?: string
            userName?: string
            fullName?: string
            getUserID?: () => string
            getUserId?: () => string
            getUserName?: () => string
            getFullName?: () => string
        }
        NOW?: {
            user?: {
                userID?: string
                userId?: string
                userName?: string
                name?: string
                fullName?: string
                sys_id?: string
                sysId?: string
            }
        }
    }
}

function getValue(field?: string | ServiceNowField): string {
    if (!field) {
        return ''
    }
    if (typeof field === 'string') {
        return field
    }
    return field.value || ''
}

function asSysId(value: unknown): string {
    if (typeof value !== 'string') {
        return ''
    }
    return /^[a-f0-9]{32}$/i.test(value) ? value : ''
}

function asText(value: unknown): string {
    return typeof value === 'string' ? value.trim() : ''
}

export class IncidentService {
    private readonly tableName = 'incident'
    private currentUserId = ''

    private async request(url: string, options: RequestInit = {}) {
        const response = await fetch(url, {
            ...options,
            headers: {
                Accept: 'application/json',
                'X-UserToken': window.g_ck,
                ...options.headers,
            },
        })

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            const message = errorData?.error?.message || `HTTP error ${response.status}`
            const detail = errorData?.error?.detail ? ` (${errorData.error.detail})` : ''
            throw new Error(`${message}${detail}`)
        }

        if (response.status === 204) {
            return { result: null }
        }

        return response.json()
    }

    async listAssignedToMe() {
        const searchParams = new URLSearchParams()
        searchParams.set('sysparm_display_value', 'all')
        searchParams.set(
            'sysparm_fields',
            'sys_id,number,short_description,description,state,assigned_to,priority,location,due_date,opened_at,work_start,work_end'
        )
        searchParams.set('sysparm_query', 'assigned_toDYNAMIC90d1921e5f510100a9ad2572f2b477fe^active=true^ORDERBYdue_date')

        const data = await this.request(`/api/now/table/${this.tableName}?${searchParams.toString()}`)
        return (data.result || []) as IncidentRecord[]
    }

    async listCloseCodeOptions() {
        const searchParams = new URLSearchParams()
        searchParams.set('sysparm_fields', 'value,label')
        searchParams.set('sysparm_limit', '100')
        searchParams.set('sysparm_query', 'name=incident^element=close_code^inactive=false^ORDERBYlabel')
        const data = await this.request(`/api/now/table/sys_choice?${searchParams.toString()}`)
        const rows: SysChoiceRow[] = Array.isArray(data?.result) ? (data.result as SysChoiceRow[]) : []
        return rows
            .map((row: SysChoiceRow) => ({
                value: getValue(row?.value).trim(),
                label: getValue(row?.label).trim() || getValue(row?.value).trim(),
            }))
            .filter((option) => option.value)
    }

    async setState(
        incident: IncidentRecord,
        state: IncidentStateValue,
        extraFields?: Record<string, string>
    ) {
        const sysId = getValue(incident.sys_id)
        if (!sysId) {
            throw new Error('Incident sys_id is missing')
        }

        const hasResolutionFields = Boolean(extraFields?.close_code || extraFields?.close_notes)
        if (state === '6' && hasResolutionFields) {
            // Some instances enforce close fields as mandatory at resolve-time.
            // Set close fields first, then transition state to Complete while
            // resending close fields in the same transition request.
            await this.request(
                `/api/now/table/${this.tableName}/${sysId}?sysparm_fields=sys_id`,
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        ...(extraFields || {}),
                    }),
                }
            )

            const resolvedData = await this.request(`/api/now/table/${this.tableName}/${sysId}?sysparm_fields=sys_id`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    state,
                    ...(extraFields || {}),
                }),
            })

            return resolvedData.result as IncidentRecord
        }

        const data = await this.request(`/api/now/table/${this.tableName}/${sysId}?sysparm_fields=sys_id`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ state, ...(extraFields || {}) }),
        })

        return data.result as IncidentRecord
    }

    async addWorkNote(incident: IncidentRecord, note: string) {
        const sysId = getValue(incident.sys_id)
        if (!sysId) {
            throw new Error('Incident sys_id is missing')
        }

        const data = await this.request(`/api/now/table/${this.tableName}/${sysId}?sysparm_fields=sys_id`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ work_notes: note }),
        })

        return data.result as IncidentRecord
    }

    private async getCurrentUserSysId() {
        if (this.currentUserId) {
            return this.currentUserId
        }

        const fromGlideUser =
            asSysId(window.g_user?.getUserID?.()) ||
            asSysId(window.g_user?.getUserId?.()) ||
            asSysId(window.g_user?.userID) ||
            asSysId(window.g_user?.userId)
        if (fromGlideUser) {
            this.currentUserId = fromGlideUser
            return fromGlideUser
        }

        const fromWindow =
            asSysId(window.NOW?.user?.userID) ||
            asSysId(window.NOW?.user?.userId) ||
            asSysId(window.NOW?.user?.sys_id) ||
            asSysId(window.NOW?.user?.sysId)
        if (fromWindow) {
            this.currentUserId = fromWindow
            return fromWindow
        }

        try {
            const userName =
                asText(window.g_user?.getUserName?.()) ||
                asText(window.g_user?.userName) ||
                asText(window.NOW?.user?.userName)
            if (userName) {
                const searchParams = new URLSearchParams()
                searchParams.set('sysparm_fields', 'sys_id')
                searchParams.set('sysparm_limit', '1')
                searchParams.set('sysparm_query', `user_name=${userName}`)
                const data = await this.request(`/api/now/table/sys_user?${searchParams.toString()}`)
                const first = Array.isArray(data?.result) ? data.result[0] : undefined
                const sysId = asSysId(getValue(first?.sys_id))
                if (sysId) {
                    this.currentUserId = sysId
                    return sysId
                }
            }
        } catch (error) {
            console.warn('Unable to resolve current user sys_id for incident defaults.', error)
        }

        return ''
    }

    async createIncident(input: { short_description: string; description: string; impact: string; urgency: string }) {
        const createdData = await this.request(`/api/now/table/${this.tableName}?sysparm_display_value=all`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                short_description: input.short_description,
                description: input.description,
                impact: input.impact,
                urgency: input.urgency,
                contact_type: 'self-service',
            }),
        })

        const created = createdData.result as IncidentRecord
        const incidentSysId = getValue(created.sys_id)
        const currentUserSysId = (await this.getCurrentUserSysId()) || getValue(created.opened_by)
        if (!incidentSysId || !currentUserSysId) {
            return created
        }

        // Apply in sequence to avoid assignment rules changing state before caller is set.
        await this.request(`/api/now/table/${this.tableName}/${incidentSysId}?sysparm_display_value=all`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                caller_id: currentUserSysId,
            }),
        })

        const updatedData = await this.request(`/api/now/table/${this.tableName}/${incidentSysId}?sysparm_display_value=all`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                assigned_to: currentUserSysId,
                state: '1',
            }),
        })

        return updatedData.result as IncidentRecord
    }
}

export function display(field?: string | ServiceNowField, fallback = ''): string {
    if (!field) {
        return fallback
    }
    if (typeof field === 'string') {
        return field
    }
    return field.display_value || field.value || fallback
}

export function value(field?: string | ServiceNowField, fallback = ''): string {
    const result = getValue(field)
    return result || fallback
}
