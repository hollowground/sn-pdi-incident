import React, { useCallback, useEffect, useRef, useState } from 'react'
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
    const [isScannerOpen, setIsScannerOpen] = useState(false)
    const [scannerError, setScannerError] = useState('')
    const [scanStatus, setScanStatus] = useState('')
    const scannerRef = useRef<{ stop: () => Promise<unknown>; clear: () => void } | null>(null)
    const lastScannedValueRef = useRef('')

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

    const stopScanner = useCallback(async () => {
        const scanner = scannerRef.current
        scannerRef.current = null
        if (!scanner) {
            return
        }
        await scanner.stop().catch(() => undefined)
        scanner.clear()
    }, [])

    const applyScannedText = useCallback((rawText: string) => {
        const trimmed = rawText.trim()
        if (!trimmed) {
            return
        }

        let nextPatch: Partial<IncidentFormData> = {}

        try {
            const parsed = JSON.parse(trimmed) as Partial<IncidentFormData>
            const shortDescription = typeof parsed.short_description === 'string' ? parsed.short_description.trim() : ''
            const description = typeof parsed.description === 'string' ? parsed.description.trim() : ''
            const impact = parsed.impact === '1' || parsed.impact === '2' || parsed.impact === '3' ? parsed.impact : ''
            const urgency = parsed.urgency === '1' || parsed.urgency === '2' || parsed.urgency === '3' ? parsed.urgency : ''

            if (shortDescription) {
                nextPatch.short_description = shortDescription
            }
            if (description) {
                nextPatch.description = description
            }
            if (impact) {
                nextPatch.impact = impact
            }
            if (urgency) {
                nextPatch.urgency = urgency
            }
        } catch {
            nextPatch = {}
        }

        if (!nextPatch.short_description) {
            nextPatch.short_description = trimmed
        }

        setFormData((previous) => ({
            ...previous,
            ...nextPatch,
        }))
        setScanStatus('QR code scanned. Fields updated.')
    }, [])

    useEffect(() => {
        let cancelled = false

        const run = async () => {
            if (!isScannerOpen) {
                return
            }
            if (!window.isSecureContext) {
                setScannerError('Camera access requires HTTPS or localhost.')
                return
            }
            if (!navigator.mediaDevices?.getUserMedia) {
                setScannerError('This browser does not support camera capture.')
                return
            }

            try {
                const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode')
                if (cancelled) {
                    return
                }

                const scanner = new Html5Qrcode('incident-form-qr-reader', {
                    formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
                    verbose: false,
                })
                scannerRef.current = scanner
                await scanner.start(
                    { facingMode: 'environment' },
                    {
                        fps: 10,
                        aspectRatio: 4 / 3,
                        qrbox: {
                            width: 240,
                            height: 240,
                        },
                    },
                    (decodedText) => {
                        const rawText = decodedText.trim()
                        if (!rawText || rawText === lastScannedValueRef.current) {
                            return
                        }
                        lastScannedValueRef.current = rawText
                        applyScannedText(rawText)
                        setIsScannerOpen(false)
                    },
                    () => {
                        // Ignore individual frame decoding misses.
                    }
                )

                if (cancelled) {
                    await stopScanner()
                }
            } catch (caughtError) {
                console.error(caughtError)
                setScannerError('Unable to start scanner. Check camera permissions and try again.')
            }
        }

        void run()

        return () => {
            cancelled = true
            void stopScanner()
        }
    }, [applyScannedText, isScannerOpen, stopScanner])

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
                        <div className="field-label-row">
                            <label htmlFor="short_description">Short Description *</label>
                            <button
                                type="button"
                                className="scan-button"
                                onClick={() => {
                                    lastScannedValueRef.current = ''
                                    setScannerError('')
                                    setScanStatus('')
                                    setIsScannerOpen(true)
                                }}
                            >
                                Scan QR
                            </button>
                        </div>
                        <input
                            type="text"
                            id="short_description"
                            name="short_description"
                            value={formData.short_description}
                            onChange={handleChange}
                            required
                            maxLength={160}
                        />
                        {scanStatus && <p className="scan-status">{scanStatus}</p>}
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
            {isScannerOpen && (
                <div className="scanner-overlay" role="dialog" aria-modal="true" aria-label="Scan QR code">
                    <div className="scanner-panel">
                        <div className="scanner-header">
                            <h3>Scan QR Code</h3>
                            <button type="button" className="close-button" onClick={() => setIsScannerOpen(false)}>
                                x
                            </button>
                        </div>
                        {scannerError ? (
                            <p className="scanner-error">{scannerError}</p>
                        ) : (
                            <>
                                <div id="incident-form-qr-reader" className="scanner-reader" />
                                <p className="scanner-hint">Point your camera at a QR code to auto-fill the form.</p>
                            </>
                        )}
                        <div className="scanner-actions">
                            <button type="button" className="cancel-button" onClick={() => setIsScannerOpen(false)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
