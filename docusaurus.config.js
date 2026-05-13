// @ts-check
// Docusaurus config — Billpay Platform Docs
// Replace the GH_USER placeholder before deploying to GitHub Pages.

import {themes as prismThemes} from 'prism-react-renderer';

const GH_USER = 'arunav-bhattacharya'; // <-- replace with your GitHub username / org
const REPO_NAME = 'billpay-docs';

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Billpay Platform',
  tagline: 'APIs, Workflows & State Machines that power payments',
  favicon: 'img/favicon.ico',

  future: {
    v4: true,
    faster: true,
  },

  url: `https://${GH_USER}.github.io`,
  baseUrl: `/${REPO_NAME}/`,

  organizationName: GH_USER,
  projectName: REPO_NAME,
  deploymentBranch: 'gh-pages',
  trailingSlash: false,

  onBrokenLinks: 'warn',

  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },
  themes: ['@docusaurus/theme-mermaid'],

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
          routeBasePath: 'docs',
          editUrl: `https://github.com/${GH_USER}/${REPO_NAME}/edit/main/`,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: 'img/social-card.svg',
      colorMode: {
        defaultMode: 'dark',
        disableSwitch: false,
        respectPrefersColorScheme: false,
      },
      docs: {
        sidebar: {
          hideable: true,
          autoCollapseCategories: false,
        },
      },
      mermaid: {
        theme: {light: 'neutral', dark: 'dark'},
      },
      navbar: {
        title: 'Billpay Platform',
        logo: {
          alt: 'Billpay',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'mainSidebar',
            position: 'left',
            label: 'Docs',
          },
          {
            to: '/docs/architecture/overview',
            label: 'Architecture',
            position: 'left',
          },
          {
            to: '/docs/diagrams/state-diagrams',
            label: 'State Diagrams',
            position: 'left',
          },
          {
            to: '/docs/diagrams/sequence-diagrams',
            label: 'Sequence Diagrams',
            position: 'left',
          },
          {
            href: `https://github.com/${GH_USER}/${REPO_NAME}`,
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {label: 'Architecture Overview', to: '/docs/architecture/overview'},
              {label: 'APIs', to: '/docs/apis/billpay-apis'},
              {label: 'SLA · SLI · SLO', to: '/docs/apis/sla-sli-slo'},
              {label: '— One-Data Functions', to: '/docs/apis/sla-sli-slo/one-data-functions'},
              {label: '— Billpay Core APIs', to: '/docs/apis/sla-sli-slo/billpay-apis'},
              {label: 'Workflows', to: '/docs/workflows/core'},
              {label: 'Payment Services', to: '/docs/services/payment-services'},
            ],
          },
          {
            title: 'Diagrams',
            items: [
              {label: 'State Diagrams', to: '/docs/diagrams/state-diagrams'},
              {label: 'Sequence Diagrams', to: '/docs/diagrams/sequence-diagrams'},
            ],
          },
          {
            title: 'Operate',
            items: [
              {label: 'Run Locally', to: '/docs/operate/run-locally'},
              {label: 'Publish to GitHub Pages', to: '/docs/operate/publish'},
            ],
          },
        ],
        copyright: `Billpay Platform Documentation — © ${new Date().getFullYear()}`,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: ['bash', 'json', 'yaml'],
      },
      tableOfContents: {
        minHeadingLevel: 2,
        maxHeadingLevel: 4,
      },
    }),
};

export default config;
