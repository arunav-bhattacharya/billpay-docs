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
    title: 'Architecture',
    desc: 'How One-Data functions, Core APIs, routers, Temporal workers, schedules and event handlers fit together.',
    to: '/docs/architecture',
  },
  {
    icon: '📐',
    title: 'Design',
    desc: 'Payment state, journeys, workflows, services, database and diagrams that model the platform.',
    to: '/docs/design',
  },
  {
    icon: '🛠️',
    title: 'Build',
    desc: 'Tech choices, monorepo modules, API specs, data model, interfaces and the deployables we ship.',
    to: '/docs/build',
  },
  {
    icon: '✅',
    title: 'Testing',
    desc: 'Unit, integration, replay and E2E patterns; plus the non-functional performance bar.',
    to: '/docs/testing',
  },
  {
    icon: '📊',
    title: 'Observability',
    desc: 'App and Temporal health, Kibana alerts, and the SLA · SLI · SLO contract per surface.',
    to: '/docs/observability',
  },
  {
    icon: '🚀',
    title: 'Deployment',
    desc: 'CI checks, code merge / PR strategy and the pipeline that promotes a commit to production.',
    to: '/docs/deployment',
  },
  {
    icon: '⚙️',
    title: 'Operations',
    desc: 'The surfaces an operator should know — Temporal UI, logs, tracing, Oracle DB — plus SOPs.',
    to: '/docs/operations',
  },
  {
    icon: '🔌',
    title: 'APIs',
    desc: 'Public contracts: One-Data Functions and Billpay Core REST endpoints.',
    to: '/docs/build/api-spec/billpay-core',
  },
  {
    icon: '🌀',
    title: 'Temporal Workflows',
    desc: 'Realtime, batch, composite and scheduled orchestrations that drive every payment lifecycle.',
    to: '/docs/design/workflows/core',
  },
  {
    icon: '🧩',
    title: 'Services',
    desc: '28 business-rule units — validation, state transitions, clearing, posting, fulfillment, notification — composed of one-or-more activities.',
    to: '/docs/design/services',
  },
  {
    icon: '⚡',
    title: 'Temporal Activities',
    desc: 'Reusable I/O units invoked by services with per-call options — clearing, AR, OTB, lifecycle writes, notifications.',
    to: '/docs/build/principles/core-build/temporal-activities',
  },
  {
    icon: '🪢',
    title: 'Sequence Diagram',
    desc: 'End-to-end sequence flows: One-Data function → Core API → Router → Workflows → Services → Activities.',
    to: '/docs/design/diagrams/sequence-diagram',
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
