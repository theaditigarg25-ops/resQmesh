# resqmesh Contract

## Events & Endpoints

| Event / Endpoint | Direction | Payload |
|---|---|---|
| **sos:trigger** | client &rarr; server | `{ id, category, description, lat, lng, battery, timestamp, deviceName }` |
| **sos:new** | server &rarr; all clients | full SOS record (as above) &mdash; fired immediately on trigger so the dashboard shows it right away |
| **sos:hop** | server &rarr; all clients | `{ sosId, fromNode, toNode, hopNumber, batteryAtNode }` |
| **sos:arrived** | server &rarr; all clients | `{ sosId, totalHops, arrivalTimeMs }` |
| **sos:triaged** | server &rarr; all clients | `{ sosId, priority: CRITICAL\|HIGH\|NORMAL, tags: [] }` |
| **sos:dispatch** | dashboard &rarr; server | `{ sosId, responderName }` |
| **sos:resolve** | dashboard &rarr; server | `{ sosId, resolution: resolved\|false_positive }` |
| **sos:statusUpdate** | server &rarr; all clients | `{ sosId, status }` |
| **GET /api/sos** | REST | returns array of all SOS records |
| **GET /api/nodes** | REST | returns array of virtual relay nodes + battery |
| **POST /api/triage** | REST | body `{ description, category }` &rarr; returns `{ priority, tags }` |
