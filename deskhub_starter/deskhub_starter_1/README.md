# DeskHub Tickets

DeskHub Tickets is a small helpdesk ticketing app built with plain HTML, CSS, and JavaScript. It supports login, dashboard stats, ticket listing, filters, pagination, detail view, comments, create/edit/delete flows, dark mode, and CSV export.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the local app:

   ```bash
   npm start
   ```

3. Open the app:

   ```text
   http://localhost:3001/
   ```

4. Log in with the demo account:

   ```text
   Email: priya@deskhub.in
   Password: demo123
   ```

## Screenshots



Suggested screenshots:

- Dashboard page with the four status cards and recent tickets.
- Tickets list with filters, search, dark mode, and CSV export.
- Ticket detail page showing ticket fields, edit controls, and comments.

Example Markdown format:

```md
![Dashboard](./docs/screenshots/dashboard.png)
![Tickets list](./docs/screenshots/tickets-list.png)
![Ticket detail](./docs/screenshots/ticket-detail.png)
```

## Main Features

- Dashboard with Total, Open, In-Progress, and Resolved counts.
- Recent 5 tickets section with links to ticket detail pages.
- Tickets list with search, filters, assignee filter, sort, pagination, and URL state.
- New Ticket modal with validated form fields.
- Ticket detail page with comments, delete confirmation, and edit mode for status, priority, and assignee.
- Toast messages, confirm modal, modal animation, and full-screen loader.
- Dark mode toggle saved in local storage.
- CSV export for the current filtered/sorted tickets list.
- Netlify static deploy support through the `netlify_deploy` folder.

## Architecture Decisions

- The app is split by feature modules inside `src/modules` so each page has its own initializer.
- API calls live in `src/api` to keep fetch logic separate from DOM rendering.
- The UI module owns shared interface pieces like toasts, modals, loaders, and theme toggling.
- Form validation is centralized in `src/modules/form.js` so create form rules are reusable and easy to test.
- Ticket detail loads ticket, comments, and users in parallel with `Promise.all` to avoid slow sequential page loads.
- User-entered content is rendered with `textContent` to avoid injecting unsafe HTML.
- The Netlify build copies the static app into `netlify_deploy`, and the client has a local-storage fallback for static hosting.

## Known Limitations

- Authentication is demo-only and stores a simple session value in local storage.
- The local API uses JSON data instead of a real database.
- On Netlify, changes are stored in the browser local storage fallback, so they are not shared across users or devices.
- CSV export downloads the currently filtered/sorted ticket set, but it does not include comments.
- There are no automated tests yet.

## What I Would Add Next

- Replace the JSON file API with a real backend and database.
- Add role-based permissions for admins, agents, and customers.
- Add automated tests for validation, ticket updates, comments, and static deploy fallback behavior.
- Add richer dashboard charts for ticket trends and agent workload.

## Deployment

To prepare the static Netlify upload folder:

```bash
npm run build:netlify
```

Then upload this folder to Netlify:

```text
netlify_deploy
```
