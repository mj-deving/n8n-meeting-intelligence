import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Setup Meeting Intelligence Sheet
// Nodes   : 2  |  Connections: 1
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// RunOnce                            webhook
// CreateSpreadsheet                  googleSheets               [creds]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// RunOnce
//    → CreateSpreadsheet
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'Cctig8XetXsoKeou',
    name: 'Setup Meeting Intelligence Sheet',
    active: true,
    settings: { executionOrder: 'v1', callerPolicy: 'workflowsFromSameOwner', availableInMCP: false },
})
export class SetupMeetingIntelligenceSheetWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'b1000001-0001-4000-8000-000000000001',
        webhookId: 'setup-meeting-sheet',
        name: 'Run Once',
        type: 'n8n-nodes-base.webhook',
        version: 2.1,
        position: [0, 300],
    })
    RunOnce = {
        httpMethod: 'GET',
        path: 'setup-meeting-sheet',
        responseMode: 'lastNode',
    };

    @node({
        id: 'b1000001-0001-4000-8000-000000000002',
        name: 'Create Spreadsheet',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.7,
        position: [300, 300],
        credentials: { googleSheetsOAuth2Api: { id: 'BU7jKOxVkaiRJphj', name: 'Google Sheets' } },
    })
    CreateSpreadsheet = {
        resource: 'spreadsheet',
        operation: 'create',
        title: 'Meeting Intelligence CRM',
        sheetsUi: {
            sheetValues: [
                {
                    title: 'Meeting Intelligence',
                    hidden: false,
                },
            ],
        },
        options: {},
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.RunOnce.out(0).to(this.CreateSpreadsheet.in(0));
    }
}
