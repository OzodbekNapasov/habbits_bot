---
name: rest-api-design
description: Standardized RESTful API architecture, HTTP status codes, consistent JSON schemas, and API documentation.
---

# REST API Design Skill

## Guidelines
1. **HTTP Verbs**: Use `GET` for retrieval, `POST` for creation, `PUT`/`PATCH` for updates, and `DELETE` for removal.
2. **Consistent Status Codes**: Return `200 OK` / `201 Created`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `500 Internal Error`.
3. **Structured Response Format**: Format API JSON responses consistently, e.g. `{ "success": true, "data": ... }` or `{ "error": { "message": ... } }`.
4. **CORS & Headers**: Set appropriate CORS headers (`Access-Control-Allow-Origin`) and `Content-Type: application/json`.
5. **Pagination**: Implement cursor or offset-based pagination (`page`, `limit`) for endpoint lists to prevent returning unbounded data.
