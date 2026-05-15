import Link from '@docusaurus/Link';

const FEATURES = [
  {
    icon: '🎯',
    title: 'Vision',
    desc: 'Why Billpay exists, the speed problem we’re solving, and how we think about it as engineers.',
    to: '/docs/vision',
  },
  {
    icon: '🧭',
    title: 'Architecture Overview',
    desc: 'How One-Data functions, Core APIs, Routers, Temporal workflows and event handlers fit together.',
    to: '/docs/architecture/overview',
  },
  {
    icon: '🔌',
    title: 'Billpay APIs',
    desc: '8 core and composite REST endpoints — payments, refunds, returns, inbound and installments.',
    to: '/docs/build/api-spec/billpay-core',
  },
  {
    icon: '⚙️',
    title: 'Workflows (Temporal)',
    desc: 'Realtime, batch, composite and scheduled workflows that orchestrate every money movement.',
    to: '/docs/design/workflows/core',
  },
  {
    icon: '🧩',
    title: 'Payment Services',
    desc: '28 reusable services — validation, state transitions, clearing, posting, fulfillment, notification.',
    to: '/docs/design/services',
  },
  {
    icon: '🔁',
    title: 'State Diagrams',
    desc: 'Mermaid state machines for all 11 core workflows — PENDING → PROCESSED, plus return / representment.',
    to: '/docs/design/diagrams/state-diagram',
  },
  {
    icon: '🪢',
    title: 'Sequence Diagrams',
    desc: 'End-to-end sequence flows from One-Data function → API → Router → Workflows → Services.',
    to: '/docs/design/diagrams/sequence-diagram',
  },
  {
    icon: '📡',
    title: 'Event Handlers',
    desc: 'Money Movement, Posted Payment, Open-To-Buy and Unstructured Payment event consumers.',
    to: '/docs/design/workflows/event-handlers',
  },
  {
    icon: '⏱️',
    title: 'Schedules',
    desc: 'Temporal Schedules that drive scheduled-payment executor, allocations processor and paid-events reconciliation.',
    to: '/docs/design/workflows/scheduled',
  },
  {
    icon: '🚀',
    title: 'Run & Publish',
    desc: 'Start the docs site locally and ship it to GitHub Pages with a single command.',
    to: '/docs/contributing/run-locally',
  },
];

export default function HomepageFeatures() {
  return (
    <section className="bp-features">
      <div className="bp-section-title">
        <h2>Everything you need, in one place</h2>
        <p>Pick a starting point</p>
      </div>
      <div className="bp-grid">
        {FEATURES.map((f) => (
          <Link key={f.title} className="bp-card" to={f.to}>
            <div className="bp-card__icon">{f.icon}</div>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
