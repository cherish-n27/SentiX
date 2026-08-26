# SentiX Data Lifecycle

SentiX currently operates as a **session-only analysis workspace**. Reviews entered through live search, drag-and-drop imports, and manual text analysis are held in the active browser session so the dashboard can calculate metrics, render charts, and generate exports. The application does not persist imported review text, SerpApi snippets, analysis results, or generated reports to the project database.

The typed server contract is defined in `server/sentiment.ts` and exposed through `server/routers.ts`. It returns a review identifier, input attribution fields, hybrid sentiment label, compound score, confidence, category, action tag, and model metadata. SerpApi and Hugging Face tokens remain server-side environment variables and are never included in responses to the browser.

> This session-only design avoids retaining customer-feedback datasets by default. Persistent history, per-user workspaces, or shared reporting should be implemented as a separate opt-in database feature with an explicit retention policy and access controls.
