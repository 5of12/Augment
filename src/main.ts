import { mount } from 'svelte';
import App from './App.svelte';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error("Could not find root element");
}

const app = mount(App, {
  target: rootElement
});

export default app;
