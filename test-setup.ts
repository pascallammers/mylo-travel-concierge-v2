import { Window } from 'happy-dom';

const window = new Window();
const document = window.document;

// Make window and document available globally
(globalThis as any).window = window;
(globalThis as any).document = document;
(globalThis as any).navigator = window.navigator;
(globalThis as any).HTMLElement = window.HTMLElement;
(globalThis as any).Element = window.Element;
(globalThis as any).Node = window.Node;
