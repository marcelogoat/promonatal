import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/prevent-zoom';
import { App } from '@/app';
import '@/styles/reference.css';
import '@/styles/app.css';

const root = document.getElementById('root');
if (!root) throw new Error('Elemento raiz da loja não encontrado.');
createRoot(root).render(<StrictMode><App /></StrictMode>);
