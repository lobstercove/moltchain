#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

let passed = 0;
let failed = 0;

function section(title) {
    console.log(`\n── ${title} ──`);
}

function pass(message) {
    passed += 1;
    console.log(`  PASS ${message}`);
}

function fail(message, detail = '') {
    failed += 1;
    console.error(`  FAIL ${message}`);
    if (detail) {
        console.error(`       ${detail}`);
    }
}

function assert(condition, message, detail = '') {
    if (condition) {
        pass(message);
        return;
    }
    fail(message, detail);
}

function readWorkspaceFile(relativePath) {
    return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

class MockClassList {
    constructor(initial = '') {
        this.values = new Set(String(initial || '').split(/\s+/).filter(Boolean));
    }

    add(...tokens) {
        tokens.filter(Boolean).forEach((token) => this.values.add(token));
    }

    remove(...tokens) {
        tokens.filter(Boolean).forEach((token) => this.values.delete(token));
    }

    toggle(token, force) {
        if (force === true) {
            this.values.add(token);
            return true;
        }
        if (force === false) {
            this.values.delete(token);
            return false;
        }
        if (this.values.has(token)) {
            this.values.delete(token);
            return false;
        }
        this.values.add(token);
        return true;
    }

    contains(token) {
        return this.values.has(token);
    }

    toString() {
        return Array.from(this.values).join(' ');
    }
}

function datasetKey(name) {
    return name
        .replace(/^data-/, '')
        .split('-')
        .map((part, index) => (index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
        .join('');
}

function attrNameFromDatasetKey(key) {
    return `data-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

class MockElement {
    constructor(tagName, attributes = {}) {
        this.tagName = String(tagName || 'div').toUpperCase();
        this.attributes = new Map();
        this.children = [];
        this.parentNode = null;
        this.listeners = new Map();
        this.style = {};
        this.dataset = {};
        this.classList = new MockClassList();
        this._textContent = '';
        this._innerHTML = '';
        this.value = '';

        Object.entries(attributes).forEach(([name, value]) => this.setAttribute(name, value));
    }

    set id(value) {
        this.setAttribute('id', value);
    }

    get id() {
        return this.getAttribute('id') || '';
    }

    set href(value) {
        this.setAttribute('href', value);
    }

    get href() {
        return this.getAttribute('href') || '';
    }

    set src(value) {
        this.setAttribute('src', value);
    }

    get src() {
        return this.getAttribute('src') || '';
    }

    set textContent(value) {
        this._textContent = String(value ?? '');
    }

    get textContent() {
        if (this.children.length === 0) {
            return this._textContent;
        }
        return this.children.map((child) => child.textContent).join('');
    }

    set innerHTML(value) {
        this._innerHTML = String(value ?? '');
        if (this._innerHTML === '') {
            this.children = [];
        }
    }

    get innerHTML() {
        return this._innerHTML;
    }

    setAttribute(name, value) {
        const normalized = String(name);
        const text = String(value ?? '');
        this.attributes.set(normalized, text);
        if (normalized === 'class') {
            this.classList = new MockClassList(text);
        }
        if (normalized.startsWith('data-')) {
            this.dataset[datasetKey(normalized)] = text;
        }
        if (normalized === 'value') {
            this.value = text;
        }
    }

    getAttribute(name) {
        return this.attributes.has(name) ? this.attributes.get(name) : null;
    }

    appendChild(child) {
        child.parentNode = this;
        this.children.push(child);
        return child;
    }

    replaceChildren(...children) {
        this.children = [];
        children.forEach((child) => this.appendChild(child));
    }

    insertBefore(child, before) {
        child.parentNode = this;
        if (!before) {
            this.children.unshift(child);
            return child;
        }
        const index = this.children.indexOf(before);
        if (index === -1) {
            this.children.push(child);
            return child;
        }
        this.children.splice(index, 0, child);
        return child;
    }

    remove() {
        if (!this.parentNode) {
            return;
        }
        const siblings = this.parentNode.children;
        const index = siblings.indexOf(this);
        if (index >= 0) {
            siblings.splice(index, 1);
        }
        this.parentNode = null;
    }

    addEventListener(type, listener) {
        const listeners = this.listeners.get(type) || [];
        listeners.push(listener);
        this.listeners.set(type, listeners);
    }

    dispatchEvent(event) {
        const listeners = this.listeners.get(event.type) || [];
        listeners.forEach((listener) => listener(event));
    }

    matches(selector) {
        return selector
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean)
            .some((entry) => matchesSimpleSelector(this, entry));
    }

    closest(selector) {
        let cursor = this;
        while (cursor) {
            if (cursor.matches(selector)) {
                return cursor;
            }
            cursor = cursor.parentNode;
        }
        return null;
    }

    querySelector(selector) {
        return this.querySelectorAll(selector)[0] || null;
    }

    querySelectorAll(selector) {
        const matches = [];
        const walk = (node) => {
            node.children.forEach((child) => {
                if (child.matches(selector)) {
                    matches.push(child);
                }
                walk(child);
            });
        };
        walk(this);
        return matches;
    }
}

function parseAttributeSelector(selector) {
    const match = selector.match(/^([^\[]+)?\[(.+)\]$/);
    if (!match) {
        return null;
    }

    const base = (match[1] || '').trim();
    const attrExpression = match[2].trim();
    const prefixMatch = attrExpression.match(/^([^=\^]+)\^="([^"]*)"$/);
    if (prefixMatch) {
        return {
            base,
            attrName: prefixMatch[1].trim(),
            comparator: '^=',
            attrValue: prefixMatch[2],
        };
    }

    const exactMatch = attrExpression.match(/^([^=]+)="([^"]*)"$/);
    if (exactMatch) {
        return {
            base,
            attrName: exactMatch[1].trim(),
            comparator: '=',
            attrValue: exactMatch[2],
        };
    }

    return {
        base,
        attrName: attrExpression,
        comparator: 'exists',
        attrValue: '',
    };
}

function baseSelectorMatches(element, selector) {
    if (!selector) {
        return true;
    }
    if (selector.startsWith('.')) {
        return element.classList.contains(selector.slice(1));
    }
    if (selector.startsWith('#')) {
        return element.id === selector.slice(1);
    }
    return element.tagName.toLowerCase() === selector.toLowerCase();
}

function matchesSimpleSelector(element, selector) {
    const attributeSelector = parseAttributeSelector(selector);
    if (attributeSelector) {
        if (!baseSelectorMatches(element, attributeSelector.base)) {
            return false;
        }
        const currentValue = element.getAttribute(attributeSelector.attrName);
        if (attributeSelector.comparator === 'exists') {
            return currentValue !== null;
        }
        if (attributeSelector.comparator === '=') {
            return currentValue === attributeSelector.attrValue;
        }
        if (attributeSelector.comparator === '^=') {
            return typeof currentValue === 'string' && currentValue.startsWith(attributeSelector.attrValue);
        }
        return false;
    }
    return baseSelectorMatches(element, selector);
}

class MockDocument {
    constructor() {
        this.listeners = new Map();
        this.body = new MockElement('body');
        this.body.dataset = {};
        this.body.style = {};
        this.body.children = [];
        this.body.parentNode = null;
    }

    addEventListener(type, listener) {
        const listeners = this.listeners.get(type) || [];
        listeners.push(listener);
        this.listeners.set(type, listeners);
    }

    dispatchEvent(event) {
        const listeners = this.listeners.get(event.type) || [];
        listeners.forEach((listener) => listener(event));
    }

    dispatchClick(target) {
        const event = {
            type: 'click',
            target,
            defaultPrevented: false,
            preventDefault() {
                this.defaultPrevented = true;
            },
        };
        this.dispatchEvent(event);
        return event;
    }

    createElement(tagName) {
        return new MockElement(tagName);
    }

    getElementById(id) {
        return this.querySelector(`#${id}`);
    }

    querySelector(selector) {
        return this.querySelectorAll(selector)[0] || null;
    }

    querySelectorAll(selector) {
        return this.body.querySelectorAll(selector);
    }
}

function createStorage() {
    const values = new Map();
    return {
        getItem(key) {
            return values.has(key) ? values.get(key) : null;
        },
        setItem(key, value) {
            values.set(key, String(value));
        },
        removeItem(key) {
            values.delete(key);
        },
    };
}

function createRuntime(pageHref) {
    const timers = [];
    const windowListeners = new Map();
    const document = new MockDocument();
    const storage = createStorage();
    const clipboard = {
        writes: [],
        writeText(text) {
            this.writes.push(String(text));
            return Promise.resolve();
        },
    };
    const location = {
        _href: pageHref,
        get href() {
            return this._href;
        },
        set href(value) {
            this._href = new URL(String(value), this._href).href;
        },
        get hostname() {
            return new URL(this._href).hostname;
        },
        reloadCalls: 0,
        reload() {
            this.reloadCalls += 1;
        },
    };

    const quietConsole = {
        log() { },
        warn() { },
        error() { },
        info() { },
    };

    const windowObject = {
        document,
        localStorage: storage,
        navigator: { clipboard },
        location,
        console: quietConsole,
        history: { pushState() { } },
        fetch: () => Promise.resolve({ ok: true, json: async () => ({ result: { mode: 'normal', severity: 'info', components: {} } }) }),
        requestAnimationFrame: (callback) => callback(),
        addEventListener(type, listener) {
            const listeners = windowListeners.get(type) || [];
            listeners.push(listener);
            windowListeners.set(type, listeners);
        },
        removeEventListener(type, listener) {
            const listeners = windowListeners.get(type) || [];
            windowListeners.set(
                type,
                listeners.filter((entry) => entry !== listener),
            );
        },
        setTimeout(callback) {
            timers.push(callback);
            return timers.length;
        },
        clearTimeout() { },
        setInterval(callback) {
            timers.push(callback);
            return timers.length;
        },
        clearInterval() { },
        URL,
        LICHEN_ENV: 'development',
        pageYOffset: 0,
        innerHeight: 900,
        IntersectionObserver: class {
            observe() { }
            unobserve() { }
            disconnect() { }
        },
    };

    const contextObject = {
        window: windowObject,
        document,
        localStorage: storage,
        navigator: windowObject.navigator,
        location,
        console: quietConsole,
        history: windowObject.history,
        fetch: windowObject.fetch,
        requestAnimationFrame: windowObject.requestAnimationFrame,
        addEventListener: windowObject.addEventListener.bind(windowObject),
        removeEventListener: windowObject.removeEventListener.bind(windowObject),
        setTimeout: windowObject.setTimeout.bind(windowObject),
        clearTimeout: windowObject.clearTimeout.bind(windowObject),
        setInterval: windowObject.setInterval.bind(windowObject),
        clearInterval: windowObject.clearInterval.bind(windowObject),
        URL,
        Event: class {
            constructor(type) {
                this.type = type;
                this.defaultPrevented = false;
            }

            preventDefault() {
                this.defaultPrevented = true;
            }
        },
        IntersectionObserver: windowObject.IntersectionObserver,
    };

    windowObject.window = windowObject;
    windowObject.self = windowObject;
    windowObject.globalThis = contextObject;
    document.defaultView = windowObject;

    contextObject.global = contextObject;
    contextObject.globalThis = contextObject;
    contextObject.__runTimers = () => {
        while (timers.length > 0) {
            const timer = timers.shift();
            timer();
        }
    };

    return {
        context: vm.createContext(contextObject),
        document,
        clipboard,
        location,
        runTimers() {
            contextObject.__runTimers();
        },
    };
}

function runScript(relativePath, context) {
    const source = readWorkspaceFile(relativePath);
    vm.runInContext(source, context, { filename: relativePath });
}

async function flushMicrotasks() {
    await Promise.resolve();
    await Promise.resolve();
}

async function testExplorerToDevelopersRewrite() {
    section('Explorer to Developers');

    const explorerHtml = readWorkspaceFile('explorer/index.html');
    assert(
        explorerHtml.includes('data-lichen-app="developers"') && explorerHtml.includes('/getting-started.html'),
        'Explorer page exposes developers cross-app navigation',
    );

    const runtime = createRuntime('http://localhost:3007/index.html');
    runtime.document.body.dataset.lichenIncidentBanner = 'off';
    const docsLink = new MockElement('a', {
        'data-lichen-app': 'developers',
        'data-lichen-path': '/getting-started.html',
    });
    runtime.document.body.appendChild(docsLink);

    runScript('explorer/shared-config.js', runtime.context);
    runtime.document.dispatchEvent(new runtime.context.Event('DOMContentLoaded'));

    assert(
        docsLink.href === 'http://localhost:3010/getting-started.html',
        'Explorer runtime rewrites docs navigation to the developer portal',
        docsLink.href,
    );
}

async function testDevelopersToProgramsRewrite() {
    section('Developers to Programs');

    const developersHtml = readWorkspaceFile('developers/playground.html');
    assert(
        developersHtml.includes('id="fullscreenPlaygroundLink"') && developersHtml.includes('id="programsPlaygroundFrame"'),
        'Developer playground page exposes fullscreen and embedded Programs targets',
    );

    const runtime = createRuntime('http://localhost:3010/playground.html');
    const fullscreenLink = new MockElement('a', { id: 'fullscreenPlaygroundLink', href: '../programs/playground.html' });
    const iframe = new MockElement('iframe', { id: 'programsPlaygroundFrame', src: '../programs/playground.html' });
    runtime.document.body.appendChild(fullscreenLink);
    runtime.document.body.appendChild(iframe);

    runScript('developers/shared-config.js', runtime.context);
    runScript('developers/js/developers.js', runtime.context);
    vm.runInContext('rewriteProgramsLinks()', runtime.context);

    assert(
        fullscreenLink.href === 'http://localhost:3012/playground.html',
        'Developer portal rewrites the fullscreen playground link to Programs',
        fullscreenLink.href,
    );
    assert(
        iframe.src === 'http://localhost:3012/playground.html',
        'Developer portal rewrites the embedded playground iframe to Programs',
        iframe.src,
    );
}

async function testProgramsInteractions() {
    section('Programs Interactions');

    const programsHtml = readWorkspaceFile('programs/index.html');
    assert(
        programsHtml.includes('data-programs-action="view-code" data-example="token"'),
        'Programs page wires a view-code action for the token example',
    );
    assert(
        programsHtml.includes('data-programs-action="copy-code"'),
        'Programs page wires copy-code actions for example snippets',
    );

    const runtime = createRuntime('http://localhost:3012/index.html');

    const codeExample = new MockElement('div', { class: 'code-example' });
    const code = new MockElement('code');
    code.textContent = 'cargo build --release';
    const copyButton = new MockElement('button', { 'data-programs-action': 'copy-code' });
    copyButton.innerHTML = '<i class="fas fa-copy"></i>';
    codeExample.appendChild(code);
    codeExample.appendChild(copyButton);

    const viewButton = new MockElement('button', {
        'data-programs-action': 'view-code',
        'data-example': 'token',
    });

    runtime.document.body.appendChild(codeExample);
    runtime.document.body.appendChild(viewButton);

    runScript('programs/js/landing.js', runtime.context);
    vm.runInContext('bindStaticControls()', runtime.context);

    runtime.document.dispatchClick(copyButton);
    await flushMicrotasks();
    assert(
        runtime.clipboard.writes[0] === 'cargo build --release',
        'Programs copy-code action writes the rendered snippet to the clipboard',
        runtime.clipboard.writes[0] || '',
    );
    assert(
        copyButton.innerHTML.includes('Copied!'),
        'Programs copy-code action updates button state after the click',
        copyButton.innerHTML,
    );

    runtime.runTimers();
    assert(
        copyButton.innerHTML === '<i class="fas fa-copy"></i>',
        'Programs copy-code action restores the original button state after the timer flush',
        copyButton.innerHTML,
    );

    runtime.document.dispatchClick(viewButton);
    assert(
        runtime.location.href === 'http://localhost:3012/playground.html?example=token',
        'Programs view-code action routes into the IDE with the selected example',
        runtime.location.href,
    );
}

async function main() {
    console.log('═══════════════════════════════════════════════');
    console.log('  Portal Interaction E2E');
    console.log('═══════════════════════════════════════════════');

    await testExplorerToDevelopersRewrite();
    await testDevelopersToProgramsRewrite();
    await testProgramsInteractions();

    console.log(`\nResults: PASS ${passed} / FAIL ${failed} / TOTAL ${passed + failed}`);
    process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});