// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  mainSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Architecture',
      collapsed: false,
      items: [
        'architecture/overview',
        'architecture/components',
        'architecture/state-model',
      ],
    },
    {
      type: 'category',
      label: 'APIs',
      collapsed: false,
      items: [
        'apis/one-data-functions',
        'apis/billpay-apis',
        {
          type: 'category',
          label: 'SLA · SLI · SLO',
          collapsed: true,
          link: {type: 'doc', id: 'apis/sla-sli-slo/index'},
          items: [
            'apis/sla-sli-slo/one-data-functions',
            'apis/sla-sli-slo/billpay-apis',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Workflows',
      collapsed: false,
      items: [
        'workflows/core',
        'workflows/composite',
        'workflows/scheduled',
        'workflows/event-handlers',
      ],
    },
    {
      type: 'category',
      label: 'Services',
      collapsed: true,
      items: ['services/payment-services'],
    },
    {
      type: 'category',
      label: 'Flows (End-to-End)',
      collapsed: false,
      items: [
        'flows/api-to-workflow',
        'flows/schedules-to-workflow',
      ],
    },
    {
      type: 'category',
      label: 'Diagrams',
      collapsed: false,
      items: [
        'diagrams/state-diagrams',
        'diagrams/sequence-diagrams',
      ],
    },
    {
      type: 'category',
      label: 'Operate the Site',
      collapsed: true,
      items: [
        'operate/run-locally',
        'operate/publish',
      ],
    },
  ],
};

export default sidebars;
