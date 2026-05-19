import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';

function Hero() {
  return (
    <header className="bp-hero">
      <div className="bp-hero__inner container">
        <div className="bp-hero__eyebrows">
          <span className="bp-hero__eyebrow">PAYMENTS</span>
          <span className="bp-hero__eyebrow">WORKFLOWS</span>
          <span className="bp-hero__eyebrow">STATE MACHINES</span>
        </div>
        <h1 className="bp-hero__title">
          Billpay <span className="bp-hero__title-grad">Wiki</span>
        </h1>
        <p className="bp-hero__sub">
          A reference for the APIs, Temporal workflows, scheduled jobs and state
          machines that move money through Billpay — designed for engineers
          building on it, and for product reviewing it.
        </p>
        <div className="bp-hero__ctas">
          <Link className="bp-hero__btn bp-hero__btn--primary" to="/docs/intro">
            Get Started →
          </Link>
          <Link className="bp-hero__btn bp-hero__btn--ghost" to="/docs/architecture/overview">
            Architecture Overview
          </Link>
          <Link className="bp-hero__btn bp-hero__btn--ghost" to="/docs/design/diagrams/state-diagram">
            State Diagrams
          </Link>
        </div>
      </div>
    </header>
  );
}

function Stats() {
  const items = [
    {num: '8', label: 'Billpay Core APIs'},
    {num: '11', label: 'Core Workflows'},
    {num: '28', label: 'Payment Services'},
    {num: '5', label: 'Scheduled Workers'},
  ];
  return (
    <section className="bp-stats">
      {items.map((it) => (
        <div key={it.label} className="bp-stat">
          <div className="bp-stat__num">{it.num}</div>
          <div className="bp-stat__label">{it.label}</div>
        </div>
      ))}
    </section>
  );
}

export default function Home() {
  return (
    <Layout
      title="Billpay Wiki"
      description="APIs, Workflows and State Machines that power the Billpay platform.">
      <Hero />
      <Stats />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
