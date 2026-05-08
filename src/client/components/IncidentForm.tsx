import React, { useEffect, useState } from 'react'
import './IncidentForm.css'

type IncidentFormData = {
    short_description: string
    description: string
    impact: string
    urgency: string
}

type IncidentLike = {
    number?: { display_value?: string } | string
    short_description?: { value?: string } | string
    description?: { value?: string } | string
    impact?: { value?: string } | string
    urgency?: { value?: string } | string
}

type IncidentFormProps = {
    incident?: IncidentLike
    onSubmit: (data: IncidentFormData) => void
    onCancel: () => void
}

export default function IncidentForm({ incident, onSubmit, onCancel }: IncidentFormProps) {
    const isEditing = Boolean(incident)
    const [formData, setFormData] = useState<IncidentFormData>({
        short_description: '',
        description: '',
        impact: '2',
        urgency: '2',
    })

    useEffect(() => {
        if (!incident) {
            return
        }

        const shortDesc = typeof incident.short_description === 'object' ? incident.short_description.value : incident.short_description
        const description = typeof incident.description === 'object' ? incident.description.value : incident.description
        const impact = typeof incident.impact === 'object' ? incident.impact.value : incident.impact
        const urgency = typeof incident.urgency === 'object' ? incident.urgency.value : incident.urgency

        setFormData({
            short_description: shortDesc || '',
            description: description || '',
            impact: impact || '2',
            urgency: urgency || '2',
        })
    }, [incident])

    const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = event.target
        setFormData((previous) => ({
            ...previous,
            [name]: value,
        }))
    }

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        onSubmit(formData)
    }

    const heading = isEditing
        ? `Edit ${typeof incident?.number === 'object' ? incident.number.display_value || 'Incident' : incident?.number || 'Incident'}`
        : 'Report New Incident'

    return (
        <div className="form-overlay">
            <div className="form-container">
                <div className="form-header">
                    <h2>{heading}</h2>
                    <button type="button" className="close-button" onClick={onCancel}>
                        x
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="short_description">Short Description *</label>
                        <input
                            type="text"
                            id="short_description"
                            name="short_description"
                            value={formData.short_description}
                            onChange={handleChange}
                            required
                            maxLength={160}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="description">Description</label>
                        <textarea
                            id="description"
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            rows={5}
                            maxLength={4000}
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="impact">Impact</label>
                            <select id="impact" name="impact" value={formData.impact} onChange={handleChange}>
                                <option value="1">1 - High</option>
                                <option value="2">2 - Medium</option>
                                <option value="3">3 - Low</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label htmlFor="urgency">Urgency</label>
                            <select id="urgency" name="urgency" value={formData.urgency} onChange={handleChange}>
                                <option value="1">1 - High</option>
                                <option value="2">2 - Medium</option>
                                <option value="3">3 - Low</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-actions">
                        <button type="button" className="cancel-button" onClick={onCancel}>
                            Cancel
                        </button>
                        <button type="submit" className="submit-button">
                            {isEditing ? 'Update' : 'Submit Incident'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
