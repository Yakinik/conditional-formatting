import { render } from 'preact';

import { WorkbenchPage } from '@/pages/workbench';

import './styles/global.css';

const root = document.getElementById('app');

if (!root) {
  throw new Error('Application root was not found');
}

render(<WorkbenchPage />, root);
