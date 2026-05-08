import '@servicenow/sdk/global'

declare global {
    namespace Now {
        namespace Internal {
            interface Keys extends KeysRegistry {
                explicit: {
                    bom_json: {
                        table: 'sys_module'
                        id: 'aee7caf3020b4923a4893960608853e8'
                    }
                    'incident-modern-app-menu': {
                        table: 'sys_app_application'
                        id: '2fb6297323fc416e82d818a789221c6c'
                    }
                    'incident-modern-app-module': {
                        table: 'sys_app_module'
                        id: '7970e8eb2a1e44d188945f622cb44a33'
                    }
                    package_json: {
                        table: 'sys_module'
                        id: 'b17d7097b21d4893b488238a19cdbe32'
                    }
                    src_server_index_ts: {
                        table: 'sys_module'
                        id: '98fc3cc72add457ab4ab52d189526b90'
                    }
                }
                composite: [
                    {
                        table: 'sn_glider_source_artifact'
                        id: '125fadc5cca14a72b8d80325a2b9cad9'
                        key: {
                            name: 'x_961032_incident_incident_manager.do - BYOUI Files'
                        }
                    },
                    {
                        table: 'sys_ui_page'
                        id: '375a1f88b4ec4e6a99e729c0c5eb2dc8'
                        key: {
                            endpoint: 'x_961032_incident_incident_manager.do'
                        }
                    },
                    {
                        table: 'sys_ux_lib_asset'
                        id: '71c0e34d22ba43cfa39742a3f93c4e50'
                        key: {
                            name: 'x_961032_incident/main'
                        }
                    },
                    {
                        table: 'sn_glider_source_artifact_m2m'
                        id: 'd59379d73ae64c7bb28c0f99a14f6137'
                        key: {
                            application_file: 'f6443b7ecafd49c0b9b7648ba4e2b1cb'
                            source_artifact: '125fadc5cca14a72b8d80325a2b9cad9'
                        }
                    },
                    {
                        table: 'sn_glider_source_artifact_m2m'
                        id: 'eb3854646df448839103a9b63537b670'
                        key: {
                            application_file: '71c0e34d22ba43cfa39742a3f93c4e50'
                            source_artifact: '125fadc5cca14a72b8d80325a2b9cad9'
                        }
                    },
                    {
                        table: 'sn_glider_source_artifact_m2m'
                        id: 'ef56613eedec46239b90d3bfb12e6995'
                        key: {
                            application_file: '375a1f88b4ec4e6a99e729c0c5eb2dc8'
                            source_artifact: '125fadc5cca14a72b8d80325a2b9cad9'
                        }
                    },
                    {
                        table: 'sys_ux_lib_asset'
                        id: 'f6443b7ecafd49c0b9b7648ba4e2b1cb'
                        key: {
                            name: 'x_961032_incident/main.js.map'
                        }
                    },
                ]
            }
        }
    }
}
