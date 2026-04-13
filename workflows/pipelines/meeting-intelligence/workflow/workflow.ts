import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Meeting Intelligence Pipeline
// Nodes   : 14  |  Connections: 13
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// TextWebhook                        webhook                  [trigger]
// AudioWebhook                       webhook                  [trigger]
// WhisperTranscription               httpRequest
// AnalyzeMeeting                     agent                    [AI]
// ClaudeModel                        lmChatOpenAi             [creds] [ai_languageModel]
// MeetingSchema                      outputParserStructured   [AI] [ai_outputParser]
// AutofixModel                       lmChatOpenAi             [creds] [ai_languageModel]
// PrepareCrmData                     code
// MeasureProcessingTime              code
// LogToGoogleSheets                  googleSheets             [creds]
// SendProtocolEmail                  gmail                    [creds]
// FormatSlackMessage                 code
// PostSlackActions                   slack                    [creds]
// WebhookResponse                    code
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// TextWebhook
//    → AnalyzeMeeting
//      → PrepareCrmData
//        → MeasureProcessingTime
//          → LogToGoogleSheets
//          → SendProtocolEmail
//          → FormatSlackMessage
//            → PostSlackActions
//          → WebhookResponse
//
// AudioWebhook
//    → WhisperTranscription
//      → AnalyzeMeeting (merge point)
//
// AI CONNECTIONS
// AnalyzeMeeting.uses({ ai_languageModel: ClaudeModel, ai_outputParser: MeetingSchema })
// MeetingSchema.uses({ ai_languageModel: AutofixModel })
// </workflow-map>

@workflow({
    id: 'meeting-intelligence-v1',
    name: 'Meeting Intelligence Pipeline',
    active: false,
    settings: { executionOrder: 'v1', callerPolicy: 'workflowsFromSameOwner', availableInMCP: false },
})
export class MeetingIntelligenceWorkflow {


    @node({
        id: 'a1000001-0001-4000-8000-000000000001',
        webhookId: 'meeting-text',
        name: 'Text Webhook',
        type: 'n8n-nodes-base.webhook',
        version: 2.1,
        position: [0, 300],
    })
    TextWebhook = {
        httpMethod: 'POST',
        path: 'meeting-text',
        responseMode: 'lastNode',
        responseCode: 200,
    };

    @node({
        id: 'a1000001-0001-4000-8000-000000000002',
        webhookId: 'meeting',
        name: 'Audio Webhook',
        type: 'n8n-nodes-base.webhook',
        version: 2.1,
        position: [0, 600],
    })
    AudioWebhook = {
        httpMethod: 'POST',
        path: 'meeting',
        responseMode: 'lastNode',
        responseCode: 200,
        options: {
            binaryData: true,
            rawBody: true,
        },
    };



    @node({
        id: 'a1000001-0001-4000-8000-000000000003',
        name: 'Whisper Transcription',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [300, 600],
    })
    WhisperTranscription = {
        method: 'POST',
        url: 'https://api.openai.com/v1/audio/transcriptions',
        authentication: 'genericCredentialType',
        genericAuthType: 'httpHeaderAuth',
        sendBody: true,
        contentType: 'multipart-form-data',
        bodyParameters: {
            parameters: [
                { parameterType: 'formBinaryData', name: 'file', inputDataFieldName: '={{ Object.keys($binary)[0] }}' },
                { parameterType: 'formData', name: 'model', value: 'whisper-1' },
                { parameterType: 'formData', name: 'language', value: 'de' },
                { parameterType: 'formData', name: 'response_format', value: 'text' },
            ],
        },
        options: {},
    };



    @node({
        id: 'a1000001-0001-4000-8000-000000000004',
        name: 'Analyze Meeting',
        type: '@n8n/n8n-nodes-langchain.agent',
        version: 3.1,
        position: [600, 300],
    })
    AnalyzeMeeting = {
        promptType: 'define',
        text: `={{ "TRANSKRIPT:\\n\\n" + ($('Text Webhook').isExecuted ? $('Text Webhook').item.json.body.transcript : $('Whisper Transcription').item.json.text) }}`,
        hasOutputParser: true,
        options: {
            systemMessage: `Du bist ein Meeting-Intelligence-Assistent. Analysiere das folgende Meeting-Transkript und extrahiere strukturierte Informationen.

TEILNEHMER: {{ $('Text Webhook').isExecuted ? $('Text Webhook').item.json.body.participants : ($('Audio Webhook').item.json.body.participants || 'Nicht angegeben') }}
DATUM: {{ $('Text Webhook').isExecuted ? $('Text Webhook').item.json.body.date : ($('Audio Webhook').item.json.body.date || new Date().toISOString().split('T')[0]) }}
TITEL: {{ $('Text Webhook').isExecuted ? $('Text Webhook').item.json.body.title : ($('Audio Webhook').item.json.body.title || 'Meeting') }}

Analysiere und antworte als JSON:
{
  "summary": "3-5 Sätze Zusammenfassung des Meetings",
  "decisions": [
    {"decision": "Was wurde beschlossen", "context": "Warum/Kontext"}
  ],
  "action_items": [
    {"owner": "Wer", "task": "Was", "deadline": "Bis wann (wenn genannt, sonst null)", "priority": "high|medium|low"}
  ],
  "open_questions": ["Frage 1", "Frage 2"],
  "follow_ups": [
    {"topic": "Thema", "when": "Wann", "participants": ["Wer"]}
  ],
  "key_topics": ["Thema 1", "Thema 2"],
  "sentiment": "positive|neutral|negative",
  "duration_estimate_min": 30
}

REGELN:
- Action Items MÜSSEN einen Owner haben. Wenn unklar, schreibe "Team".
- Deadlines nur eintragen wenn explizit im Meeting genannt.
- Entscheidungen klar von Diskussionen trennen.
- Deutsche Sprache, professioneller Stil.`,
        },
    };

    @node({
        id: 'a1000001-0001-4000-8000-000000000005',
        name: 'Claude Model',
        type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
        version: 1.3,
        position: [600, 520],
        credentials: { openAiApi: { id: 'mOL6UoYXfgKf6RZh', name: 'OpenRouter' } },
    })
    ClaudeModel = {
        model: {
            __rl: true,
            mode: 'list',
            value: 'anthropic/claude-sonnet-4-20250514',
        },
        options: {},
    };

    @node({
        id: 'a1000001-0001-4000-8000-000000000006',
        name: 'Meeting Schema',
        type: '@n8n/n8n-nodes-langchain.outputParserStructured',
        version: 1.3,
        position: [800, 520],
    })
    MeetingSchema = {
        schemaType: 'manual',
        inputSchema: '{"type":"object","properties":{"summary":{"type":"string","description":"3-5 Sätze Zusammenfassung des Meetings"},"decisions":{"type":"array","items":{"type":"object","properties":{"decision":{"type":"string","description":"Was wurde beschlossen"},"context":{"type":"string","description":"Warum/Kontext der Entscheidung"}},"required":["decision","context"]},"description":"Liste der getroffenen Entscheidungen"},"action_items":{"type":"array","items":{"type":"object","properties":{"owner":{"type":"string","description":"Verantwortliche Person"},"task":{"type":"string","description":"Aufgabe"},"deadline":{"type":["string","null"],"description":"Deadline wenn genannt, sonst null"},"priority":{"type":"string","enum":["high","medium","low"],"description":"Priorität"}},"required":["owner","task","deadline","priority"]},"description":"Action Items mit Owner, Task, Deadline, Priority"},"open_questions":{"type":"array","items":{"type":"string"},"description":"Offene Fragen aus dem Meeting"},"follow_ups":{"type":"array","items":{"type":"object","properties":{"topic":{"type":"string","description":"Follow-up Thema"},"when":{"type":"string","description":"Wann soll nachgefasst werden"},"participants":{"type":"array","items":{"type":"string"},"description":"Beteiligte Personen"}},"required":["topic","when","participants"]},"description":"Geplante Follow-ups"},"key_topics":{"type":"array","items":{"type":"string"},"description":"Hauptthemen des Meetings"},"sentiment":{"type":"string","enum":["positive","neutral","negative"],"description":"Gesamtstimmung des Meetings"},"duration_estimate_min":{"type":"integer","description":"Geschätzte Meeting-Dauer in Minuten"}},"required":["summary","decisions","action_items","open_questions","follow_ups","key_topics","sentiment","duration_estimate_min"]}',
        autoFix: true,
    };

    @node({
        id: 'a1000001-0001-4000-8000-000000000007',
        name: 'AutoFix Model',
        type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
        version: 1.3,
        position: [800, 720],
        credentials: { openAiApi: { id: 'mOL6UoYXfgKf6RZh', name: 'OpenRouter' } },
    })
    AutofixModel = {
        model: {
            __rl: true,
            mode: 'list',
            value: 'google/gemini-2.0-flash-001',
        },
        options: {},
    };

    //DATA PREPARATION


    @node({
        id: 'a1000001-0001-4000-8000-000000000008',
        name: 'Prepare CRM Data',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [900, 300],
    })
    PrepareCrmData = {
        mode: 'runOnceForEachItem',
        language: 'javaScript',
        jsCode: `const isTextInput = $('Text Webhook').isExecuted;
const meta = isTextInput
  ? $('Text Webhook').item.json.body
  : $('Audio Webhook').item.json.body;
const ai = $input.item.json.output;
const transcript = isTextInput
  ? meta.transcript
  : $('Whisper Transcription').item.json.text;

const wordCount = (transcript || '').split(/\\s+/).filter(w => w.length > 0).length;

const decisionsText = (ai.decisions || [])
  .map((d, i) => \`\${i + 1}. \${d.decision} (Kontext: \${d.context})\`)
  .join('\\n');

const actionItemsText = (ai.action_items || [])
  .map(a => \`• \${a.owner}: \${a.task}\${a.deadline ? ' (bis ' + a.deadline + ')' : ''} [\${a.priority}]\`)
  .join('\\n');

const openQuestionsText = (ai.open_questions || [])
  .map((q, i) => \`\${i + 1}. \${q}\`)
  .join('\\n');

const followUpsText = (ai.follow_ups || [])
  .map(f => \`• \${f.topic} — \${f.when} (\${f.participants.join(', ')})\`)
  .join('\\n');

// Capture webhook arrival time for processing duration measurement
const webhookNode = isTextInput ? $('Text Webhook') : $('Audio Webhook');
const startTime = new Date(webhookNode.item.json.headers['date'] || Date.now()).getTime();

return {
  json: {
    Timestamp: new Date().toISOString(),
    Meeting_Title: meta.title || 'Meeting',
    Date: meta.date || new Date().toISOString().split('T')[0],
    Participants: meta.participants || '',
    Summary: ai.summary,
    Decisions: decisionsText,
    Action_Items: actionItemsText,
    Open_Questions: openQuestionsText,
    Follow_Ups: followUpsText,
    Sentiment: ai.sentiment,
    Transcript_Length: wordCount,
    Processing_Time_Sec: 0,
    // _-prefixed fields excluded from Sheets by column filter below
    _ai: ai,
    _meta: meta,
    _startTime: startTime,
  }
};`,
    };

    @node({
        id: 'a1000001-0001-4000-8000-000000000009',
        name: 'Measure Processing Time',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1100, 300],
    })
    MeasureProcessingTime = {
        mode: 'runOnceForEachItem',
        language: 'javaScript',
        jsCode: `const data = { ...$input.item.json };
data.Processing_Time_Sec = Math.round((Date.now() - data._startTime) / 1000);
return { json: data };`,
    };

    //OUTPUT NODES


    @node({
        id: 'a1000001-0001-4000-8000-000000000010',
        name: 'Log to Google Sheets',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.7,
        position: [1400, 100],
        credentials: { googleSheetsOAuth2Api: { id: 'BU7jKOxVkaiRJphj', name: 'Google Sheets' } },
    })
    LogToGoogleSheets = {
        resource: 'sheet',
        operation: 'append',
        documentId: {
            __rl: true,
            mode: 'url',
            value: '',
        },
        sheetName: {
            __rl: true,
            mode: 'name',
            value: 'Meeting Intelligence',
        },
        dataMode: 'defineBelow',
        columns: {
            mappingMode: 'defineBelow',
            value: [
                { column: 'Timestamp', fieldValue: '={{ $json.Timestamp }}' },
                { column: 'Meeting_Title', fieldValue: '={{ $json.Meeting_Title }}' },
                { column: 'Date', fieldValue: '={{ $json.Date }}' },
                { column: 'Participants', fieldValue: '={{ $json.Participants }}' },
                { column: 'Summary', fieldValue: '={{ $json.Summary }}' },
                { column: 'Decisions', fieldValue: '={{ $json.Decisions }}' },
                { column: 'Action_Items', fieldValue: '={{ $json.Action_Items }}' },
                { column: 'Open_Questions', fieldValue: '={{ $json.Open_Questions }}' },
                { column: 'Follow_Ups', fieldValue: '={{ $json.Follow_Ups }}' },
                { column: 'Sentiment', fieldValue: '={{ $json.Sentiment }}' },
                { column: 'Transcript_Length', fieldValue: '={{ $json.Transcript_Length }}' },
                { column: 'Processing_Time_Sec', fieldValue: '={{ $json.Processing_Time_Sec }}' },
            ],
        },
        options: {},
    };

    @node({
        id: 'a1000001-0001-4000-8000-000000000011',
        name: 'Send Protocol Email',
        type: 'n8n-nodes-base.gmail',
        version: 2.2,
        position: [1400, 300],
        credentials: { gmailOAuth2: { id: 'QZcdvolqgtbfPfBE', name: 'Gmail' } },
    })
    SendProtocolEmail = {
        resource: 'message',
        operation: 'send',
        sendTo: '={{ $json._meta.email || "mariusclaude@proton.me" }}',
        subject: '={{ "Protokoll: " + $json.Meeting_Title + " (" + $json.Date + ")" }}',
        emailType: 'html',
        message: `={{ "<h2>Meeting-Protokoll: " + $json.Meeting_Title + "</h2>" +
"<p><strong>Datum:</strong> " + $json.Date + "<br>" +
"<strong>Teilnehmer:</strong> " + $json.Participants + "</p>" +

"<h3>Zusammenfassung</h3>" +
"<p>" + $json.Summary + "</p>" +

"<h3>Entscheidungen</h3>" +
"<ul>" + ($json._ai.decisions || []).map(d => "<li><strong>" + d.decision + "</strong> — " + d.context + "</li>").join("") + "</ul>" +

"<h3>Action Items</h3>" +
"<table border='1' cellpadding='6' cellspacing='0' style='border-collapse:collapse;width:100%'>" +
"<tr style='background:#f0f0f0'><th>Wer</th><th>Was</th><th>Bis wann</th><th>Priorität</th></tr>" +
($json._ai.action_items || []).map(a =>
  "<tr" + (a.priority === "high" ? " style='background:#fff3cd'" : "") + ">" +
  "<td>" + a.owner + "</td><td>" + a.task + "</td><td>" + (a.deadline || "—") + "</td><td>" + a.priority + "</td></tr>"
).join("") +
"</table>" +

"<h3>Offene Fragen</h3>" +
"<ul>" + ($json._ai.open_questions || []).map(q => "<li>" + q + "</li>").join("") + "</ul>" +

"<h3>Nächste Schritte</h3>" +
"<ul>" + ($json._ai.follow_ups || []).map(f => "<li><strong>" + f.topic + "</strong> — " + f.when + " (" + f.participants.join(", ") + ")</li>").join("") + "</ul>" +

"<hr><p style='color:#888;font-size:12px'>Dieses Protokoll wurde automatisch erstellt. Bei Korrekturen bitte antworten.</p>" }}`,
        options: {},
    };

    @node({
        id: 'a1000001-0001-4000-8000-000000000012',
        name: 'Format Slack Message',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1400, 500],
    })
    FormatSlackMessage = {
        mode: 'runOnceForEachItem',
        language: 'javaScript',
        jsCode: `const ai = $json._ai;
const meta = $json._meta;
const hasUrgent = (ai.action_items || []).some(a => a.priority === 'high');

let text = '';
if (hasUrgent) {
  text += '<!channel> ';
}
text += \`*📋 Meeting-Protokoll: \${meta.title}*\\n\`;
text += \`_\${meta.date} | Teilnehmer: \${meta.participants}_\\n\\n\`;
text += \`*Zusammenfassung:* \${ai.summary}\\n\\n\`;

text += '*Action Items:*\\n';
for (const a of (ai.action_items || [])) {
  const icon = a.priority === 'high' ? '🔴' : a.priority === 'medium' ? '🟡' : '⚪';
  text += \`  \${icon} *\${a.owner}*: \${a.task}\`;
  if (a.deadline) text += \` (bis \${a.deadline})\`;
  text += '\\n';
}

if ((ai.decisions || []).length > 0) {
  text += '\\n*Entscheidungen:*\\n';
  for (const d of ai.decisions) {
    text += \`  ✅ \${d.decision}\\n\`;
  }
}

return { json: { text, hasUrgent } };`,
    };

    @node({
        id: 'a1000001-0001-4000-8000-000000000013',
        name: 'Post Slack Actions',
        type: 'n8n-nodes-base.slack',
        version: 2.4,
        position: [1700, 500],
        credentials: { slackApi: { id: 'eAfCfOcljgXJsdU2', name: 'Slack Bot' } },
    })
    PostSlackActions = {
        authentication: 'accessToken',
        resource: 'message',
        operation: 'post',
        select: 'channel',
        channelId: {
            __rl: true,
            mode: 'id',
            value: 'C0ASXU219GQ',
        },
        messageType: 'text',
        text: '={{ $json.text }}',
        options: {},
    };

    @node({
        id: 'a1000001-0001-4000-8000-000000000014',
        name: 'Webhook Response',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1700, 300],
    })
    WebhookResponse = {
        mode: 'runOnceForEachItem',
        language: 'javaScript',
        jsCode: `const data = $input.item.json;
return {
  json: {
    status: 'success',
    meeting_title: data.Meeting_Title,
    date: data.Date,
    summary: data.Summary,
    decisions_count: (data._ai.decisions || []).length,
    action_items_count: (data._ai.action_items || []).length,
    processing_time_sec: data.Processing_Time_Sec,
    sentiment: data.Sentiment,
  }
};`,
    };

    //ROUTING AND CONNECTIONS


    @links()
    defineRouting() {
        // Text path: TextWebhook → AnalyzeMeeting
        this.TextWebhook.out(0).to(this.AnalyzeMeeting.in(0));

        // Audio path: AudioWebhook → WhisperTranscription → AnalyzeMeeting
        this.AudioWebhook.out(0).to(this.WhisperTranscription.in(0));
        this.WhisperTranscription.out(0).to(this.AnalyzeMeeting.in(0));

        // Analysis → Data Prep → Processing Time
        this.AnalyzeMeeting.out(0).to(this.PrepareCrmData.in(0));
        this.PrepareCrmData.out(0).to(this.MeasureProcessingTime.in(0));

        // Fan-out to all outputs
        this.MeasureProcessingTime.out(0).to(this.LogToGoogleSheets.in(0));
        this.MeasureProcessingTime.out(0).to(this.SendProtocolEmail.in(0));
        this.MeasureProcessingTime.out(0).to(this.FormatSlackMessage.in(0));
        this.MeasureProcessingTime.out(0).to(this.WebhookResponse.in(0));

        // Slack formatting → Slack post
        this.FormatSlackMessage.out(0).to(this.PostSlackActions.in(0));

        // AI connections
        this.AnalyzeMeeting.uses({
            ai_languageModel: this.ClaudeModel.output,
            ai_outputParser: this.MeetingSchema.output,
        });
        this.MeetingSchema.uses({
            ai_languageModel: this.AutofixModel.output,
        });
    }
}
