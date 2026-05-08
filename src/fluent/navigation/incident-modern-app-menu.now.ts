import '@servicenow/sdk/global'
import { ApplicationMenu, Record } from '@servicenow/sdk/core'

const incidentModernAppMenu = ApplicationMenu({
    $id: Now.ID['incident-modern-app-menu'],
    title: 'Incident Modern App',
    name: 'incident_modern_app',
    hint: 'Incident workflow workspace',
    description: 'Mobile-style incident workflow dashboard',
    active: true,
    order: 100,
})

Record({
    $id: Now.ID['incident-modern-app-module'],
    table: 'sys_app_module',
    data: {
        title: 'Incident Modern App',
        application: incidentModernAppMenu,
        link_type: 'DIRECT',
        query: 'x_961032_incident_incident_manager.do?sysparm_direct=true&sysparm_nostack=true&standalone=1',
        active: true,
        order: 100,
    },
})
