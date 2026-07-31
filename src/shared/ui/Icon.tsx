import type { JSX } from 'preact';

export type IconName =
  | 'arrowDown'
  | 'arrowUp'
  | 'check'
  | 'chevron'
  | 'close'
  | 'copy'
  | 'eye'
  | 'file'
  | 'grid'
  | 'info'
  | 'panel'
  | 'paste'
  | 'plus'
  | 'reset'
  | 'rules'
  | 'trash'
  | 'upload';

interface IconProps extends JSX.SVGAttributes<SVGSVGElement> {
  name: IconName;
  size?: number;
}

const paths: Record<IconName, JSX.Element> = {
  arrowDown: <><path d="m7 10 5 5 5-5" /><path d="M12 4v11" /></>,
  arrowUp: <><path d="m7 9 5-5 5 5" /><path d="M12 20V4" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  close: <><path d="m6 6 12 12" /><path d="m18 6-12 12" /></>,
  copy: <><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
  eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></>,
  file: <><path d="M6 2h8l4 4v16H6z" /><path d="M14 2v5h5" /></>,
  grid: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 3v18" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
  panel: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16" /></>,
  paste: <><path d="M9 5h6M9 3h6v4H9z" /><path d="M8 5H5v16h14V5h-3" /><path d="M9 13h6M9 17h4" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  reset: <><path d="M4 11a8 8 0 1 0 2-5" /><path d="M4 4v7h7" /></>,
  rules: <><path d="M4 6h10M4 12h16M4 18h7" /><circle cx="18" cy="6" r="2" /><circle cx="14" cy="18" r="2" /></>,
  trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" /></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 15v5h16v-5" /></>
};

export const Icon = ({ name, size = 18, ...props }: IconProps): JSX.Element => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    viewBox="0 0 24 24"
    width={size}
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    stroke-width="1.8"
    {...props}
  >
    {paths[name]}
  </svg>
);
