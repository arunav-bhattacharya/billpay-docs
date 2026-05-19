import Link from '@docusaurus/Link';

const FEATURES = [
  {
    icon: '🎯',
    title: 'Vision',
    desc: 'Why Billpay exists, the speed problem we’re solving, and how we think about it as engineers.',
    to: '/docs/vision',
    tone: 'iris',
  },
  {
    icon: '🧭',
    title: 'Architecture',
    desc: 'How One-Data functions, Core APIs, routers, Temporal workers, schedules and event handlers fit together.',
    to: '/docs/architecture',
    tone: 'cyan',
  },
  {
    icon: '📐',
    title: 'Design',
    desc: 'Payment state, journeys, workflows, services, database and diagrams that model the platform.',
    to: '/docs/design',
    tone: 'iris',
  },
  {
    icon: '🛠️',
    title: 'Build',
    desc: 'Tech choices, monorepo modules, API specs, data model, interfaces and the deployables we ship.',
    to: '/docs/build',
    tone: 'amber',
  },
  {
    icon: '✅',
    title: 'Testing',
    desc: 'Unit, integration, replay and E2E patterns; plus the non-functional performance bar.',
    to: '/docs/testing',
    tone: 'mint',
  },
  {
    icon: '📊',
    title: 'Observability',
    desc: 'App and Temporal health, Kibana alerts, and the SLA · SLI · SLO contract per surface.',
    to: '/docs/observability',
    tone: 'mint',
  },
  {
    icon: '🚀',
    title: 'Deployment',
    desc: 'CI checks, code merge / PR strategy and the pipeline that promotes a commit to production.',
    to: '/docs/deployment',
    tone: 'rose',
  },
  {
    icon: '⚙️',
    title: 'Operations',
    desc: 'The surfaces an operator should know — Temporal UI, logs, tracing, Oracle DB — plus SOPs.',
    to: '/docs/operations',
    tone: 'rose',
  },
  {
    icon: '🔌',
    title: 'APIs',
    desc: 'Public contracts: One-Data Functions and Billpay Core REST endpoints.',
    to: '/docs/build/api-spec/billpay-core',
    tone: 'cyan',
  },
  {
    icon: '🌀',
    title: 'Temporal Workflows',
    desc: 'Realtime, batch, composite and scheduled orchestrations that drive every payment lifecycle.',
    to: '/docs/design/workflows/core',
    tone: 'violet',
  },
  {
    icon: '🧩',
    title: 'Services',
    desc: '28 business-rule units — validation, state transitions, clearing, posting, fulfillment, notification — composed of one-or-more activities.',
    to: '/docs/design/services',
    tone: 'amber',
  },
  {
    icon: '⚡',
    title: 'Temporal Activities',
    desc: 'Reusable I/O units invoked by services with per-call options — clearing, AR, OTB, lifecycle writes, notifications.',
    to: '/docs/build/principles/core-build/temporal-activities',
    tone: 'violet',
  },
  {
    icon: '🚦',
    title: 'Payment State Model',
    desc: 'The canonical state machine every payment travels through — terminal vs non-terminal states and the transitions between them.',
    to: '/docs/design/payment-state-model',
    tone: 'iris',
  },
  {
    icon: '🪢',
    title: 'Sequence Diagram',
    desc: 'End-to-end sequence flows: One-Data function → Core API → Router → Workflows → Services → Activities.',
    to: '/docs/design/diagrams/sequence-diagram',
    tone: 'cyan',
  },
  {
    icon: '🎯',
    title: 'SLA · SLI · SLO',
    desc: 'External commitments, internal objectives, and the indicators we measure them with — per One-Data function and per Core API.',
    to: '/docs/observability/monitoring/sla-sli-slo',
    tone: 'mint',
  },
];

export default function HomepageFeatures() {
  return (
    <section className="bp-features">
      <div className="bp-section-title">
        <span className="bp-section-title__rule" aria-hidden="true" />
        <h2>Everything you need, in one place</h2>
        <p>Pick a starting point</p>
      </div>
      <div className="bp-grid">
        {FEATURES.map((f) => (
          <Link key={f.title} className={`bp-card bp-card--${f.tone}`} to={f.to}>
            <span className="bp-card__rail" aria-hidden="true" />
            <div className="bp-card__icon">{f.icon}</div>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
