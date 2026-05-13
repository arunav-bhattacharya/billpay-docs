import React, {useState, useEffect} from 'react';
import clsx from 'clsx';
import {ThemeClassNames} from '@docusaurus/theme-common';
import {useDoc} from '@docusaurus/plugin-content-docs/client';
import TOC from '@theme/TOC';

const STORAGE_KEY = 'bp.toc.collapsed';

function ListIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true">
      <line x1="3" y1="4" x2="13" y2="4" />
      <line x1="3" y1="8" x2="13" y2="8" />
      <line x1="3" y1="12" x2="10" y2="12" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true">
      <path d="M2 8s2.5-4.5 6-4.5S14 8 14 8s-2.5 4.5-6 4.5S2 8 2 8z" />
      <circle cx="8" cy="8" r="1.6" />
      <line x1="3" y1="3" x2="13" y2="13" />
    </svg>
  );
}

export default function DocItemTOCDesktop() {
  const {toc, frontMatter} = useDoc();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === '1') setCollapsed(true);
    } catch (e) {}
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch (e) {}
      return next;
    });
  };

  return (
    <div className={clsx('bp-toc', collapsed && 'bp-toc--collapsed')}>
      <button
        type="button"
        className="bp-toc__toggle"
        onClick={toggle}
        aria-expanded={!collapsed}
        aria-controls="bp-toc-body"
        aria-label={collapsed ? 'Show table of contents' : 'Hide table of contents'}
        title={collapsed ? 'Show table of contents' : 'Hide table of contents'}>
        <span className="bp-toc__toggle-icon" aria-hidden="true">
          {collapsed ? <ListIcon /> : <EyeOffIcon />}
        </span>
      </button>

      {!collapsed && (
        <div id="bp-toc-body" className="bp-toc__body">
          <TOC
            toc={toc}
            minHeadingLevel={frontMatter.toc_min_heading_level}
            maxHeadingLevel={frontMatter.toc_max_heading_level}
            className={clsx(ThemeClassNames.docs.docTocDesktop, 'bp-toc__list')}
          />
        </div>
      )}
    </div>
  );
}
