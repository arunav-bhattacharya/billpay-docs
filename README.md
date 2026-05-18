# Billpay Wiki

A Docusaurus-powered documentation site for the **Billpay platform** — APIs,
Temporal workflows, payment services and state machines.

## Quickstart

```bash
npm install
npm run start
```

Open http://localhost:3000/billpay-docs/

## Build

```bash
npm run build      # produces ./build
npm run serve      # smoke-test the production bundle
```

## Publish to GitHub Pages

1. Edit `docusaurus.config.js` and replace `YOUR_GH_USER` with your GitHub
   username / org.
2. One-shot deploy from your laptop:

   ```bash
   GIT_USER=<your-github-username> USE_SSH=true npm run deploy
   ```

3. Or use the GitHub Actions workflow described in
   [`docs/operate/publish.md`](docs/operate/publish.md).

## Site structure

```
docs/
├── intro.md
├── architecture/        # overview, components, state model
├── apis/                # One-Data functions + Billpay Core APIs
├── workflows/           # core, composite, scheduled, event handlers
├── services/            # Payment Services reference
├── flows/               # API → Workflow + Schedules → Workflow
├── diagrams/            # state diagrams + sequence diagrams
└── operate/             # run locally + publish guides
```

## Tech

- [Docusaurus 3](https://docusaurus.io/)
- [@docusaurus/theme-mermaid](https://docusaurus.io/docs/markdown-features/diagrams) for state + sequence diagrams
- Dark theme by default, Amex-inspired blue palette

## Editing

All content lives under `docs/` as plain markdown with Mermaid fences. Add a
new file and link it from `sidebars.js`.
