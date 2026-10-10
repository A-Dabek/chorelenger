import { render } from 'preact';
import { App } from './App.jsx';
import './style.css';

render(<App />, document.getElementById('app'));

if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js');
