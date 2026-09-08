// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountStarsilkStarmap, parseEraValue, type CartographerHandle } from '../src/viewer/mount';
import {
  registerStarsilkStarmap,
  StarsilkStarmapElement,
  STARSILK_STARMAP_TAG,
} from '../src/viewer/element';
import { createDemoProject } from '../src/core/demo';
import { serializeProject } from '../src/core/schema';

let handle: CartographerHandle | null = null;
let container: HTMLElement | null = null;

const mount = (options: Parameters<typeof mountStarsilkStarmap>[1] = {}) => {
  container = document.createElement('div');
  document.body.append(container);
  handle = mountStarsilkStarmap(container, { project: createDemoProject(), ...options });
  return handle;
};

afterEach(() => {
  handle?.destroy();
  handle = null;
  container?.remove();
  container = null;
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

describe('parseEraValue', () => {
  it('keeps war years numeric and preset ids textual', () => {
    expect(parseEraValue('3')).toBe(3);
    expect(parseEraValue('-170')).toBe(-170);
    expect(parseEraValue('12.5')).toBe(12.5);
    expect(parseEraValue('bew-170')).toBe('bew-170');
    expect(parseEraValue('main-narrative')).toBe('main-narrative');
    expect(parseEraValue(170)).toBe(170);
    expect(parseEraValue('')).toBeUndefined();
    expect(parseEraValue(null)).toBeUndefined();
  });
});

describe('mountStarsilkStarmap', () => {
  it('mounts the real interface inside a shadow root', () => {
    const viewer = mount({ mode: 'viewer' });
    const shadow = container!.shadowRoot;
    expect(shadow, 'expected an open shadow root').toBeTruthy();
    expect(shadow!.querySelector('.sktc')).toBeTruthy();
    expect(shadow!.querySelector('.sktc-rail')).toBeTruthy();
    expect(shadow!.querySelector('#sktc-hierarchy')).toBeTruthy();
    expect(viewer.mode).toBe('viewer');
    expect(viewer.project()?.entities.length).toBe(28);
  });

  it('injects its stylesheet into the shadow root, never into the document', () => {
    mount({ mode: 'viewer' });
    // A stylesheet is injected into the shadow root. (Its text is stubbed empty by
    // the test runner's CSS handling; the built bundle is checked separately —
    // `dist-viewer/starsilk-viewer.js` carries the same rules inline.)
    const injected = container!.shadowRoot?.querySelectorAll('style') ?? [];
    expect(injected.length).toBe(1);

    const leaked = [...document.querySelectorAll('style')]
      .map((style) => style.textContent ?? '')
      .join('');
    expect(leaked).not.toContain('.sktc');
  });

  it('disables authoring in viewer mode but still allows era scrubbing', () => {
    const viewer = mount({ mode: 'viewer' });
    const shadow = container!.shadowRoot!;

    // Authoring is refused at the store level…
    const store = (shadow.querySelector('#sktc-hierarchy') as HTMLElement)
      ? (viewer as unknown as { project: () => unknown })
      : null;
    expect(store).toBeTruthy();

    // …and the authoring affordances are hidden or disabled.
    expect(shadow.querySelector('#sktc-import')?.hasAttribute('disabled')).toBe(true);
    expect(shadow.querySelector('#sktc-demo')?.hasAttribute('disabled')).toBe(true);
    expect(shadow.querySelector('#sktc-viewer-mode')).toBeNull();

    // Era navigation stays available: it is inspection, not authoring.
    viewer.setEra(3);
    const root = viewer.project()!.entities.find((e) => e.id === 'galaxy-root')!;
    expect(root.time).toEqual({ mode: 'override', overrideValue: 3 });

    viewer.setEra('post-siege-wall');
    expect(viewer.project()!.entities.find((e) => e.id === 'galaxy-root')!.time).toEqual({
      mode: 'override',
      overrideValue: 'post-siege-wall',
    });
  });

  it('accepts era as a string attribute value', () => {
    const viewer = mount({ mode: 'viewer' });
    viewer.setEra('170');
    expect(viewer.project()!.entities.find((e) => e.id === 'galaxy-root')!.time).toEqual({
      mode: 'override',
      overrideValue: 170,
    });
  });

  it('starts on a named entity and reports navigation', () => {
    const navigated: Array<{ entityId: string; name: string }> = [];
    const viewer = mount({
      mode: 'viewer',
      entity: 'planet-fallenstar-prime',
      era: 3,
      onNavigate: (detail) => navigated.push(detail),
    });
    expect(navigated).toEqual([{ entityId: 'planet-fallenstar-prime', name: 'FALLENSTAR PRIME' }]);

    // Focus by display name as well as by id.
    expect(viewer.focusEntity('FIRST BLOOD RING')).toBe(true);
    expect(navigated.at(-1)?.entityId).toBe('ring-fallenstar');
    expect(viewer.focusEntity('does-not-exist')).toBe(false);
  });

  it('refuses an invalid project and reports through onError', () => {
    const errors: Error[] = [];
    container = document.createElement('div');
    document.body.append(container);
    handle = mountStarsilkStarmap(container, {
      mode: 'viewer',
      project: { schemaVersion: 1, not: 'a project' },
      onError: (error) => errors.push(error),
    });
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toMatch(/Invalid STARSiLK map project/);
    expect(handle.project()).toBeNull();
  });

  it('replaces the project at runtime', () => {
    const viewer = mount({ mode: 'viewer' });
    expect(viewer.project()!.title).toBe('STARSiLK DEMONSTRATION PLATE');
    expect(viewer.setProject({ nope: true })).toBe(false);
    expect(viewer.project()!.title).toBe('STARSiLK DEMONSTRATION PLATE');

    const replacement = { ...createDemoProject(), title: 'REPLACEMENT PLATE' };
    expect(viewer.setProject(replacement)).toBe(true);
    expect(viewer.project()!.title).toBe('REPLACEMENT PLATE');
  });

  it('fetches from src and mounts the fetched document', async () => {
    const json = serializeProject(createDemoProject());
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => json,
      })),
    );
    container = document.createElement('div');
    document.body.append(container);
    handle = mountStarsilkStarmap(container, { mode: 'viewer', src: './data/starsilk-map.json' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetch).toHaveBeenCalledWith('./data/starsilk-map.json', { credentials: 'same-origin' });
    expect(handle.project()?.entities.length).toBe(28);
  });

  it('reports a failed fetch through onError', async () => {
    const errors: Error[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404, text: async () => '' })),
    );
    container = document.createElement('div');
    document.body.append(container);
    handle = mountStarsilkStarmap(container, {
      mode: 'viewer',
      src: './missing.json',
      onError: (error) => errors.push(error),
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(errors.map((e) => e.message).join(' ')).toMatch(/HTTP 404/);
  });

  it('enables authoring when mounted in editor mode', () => {
    const viewer = mount({ mode: 'editor' });
    const shadow = container!.shadowRoot!;
    expect(shadow.querySelector('#sktc-import')?.hasAttribute('disabled')).toBe(false);
    expect(shadow.querySelector('#sktc-viewer-mode')).toBeTruthy();
    expect(viewer.mode).toBe('editor');
  });

  it('tears down completely', () => {
    const viewer = mount({ mode: 'viewer' });
    const shadow = container!.shadowRoot!;
    expect(shadow.querySelector('.sktc')).toBeTruthy();
    viewer.destroy();
    expect(shadow.querySelector('.sktc')).toBeNull();
    expect(container!.contains(viewer.element)).toBe(false);
    handle = null;
  });

  it('never exposes Three.js objects through the seam', () => {
    const viewer = mount({ mode: 'viewer' });
    const exported = JSON.stringify(viewer.project());
    expect(exported).not.toContain('Object3D');
    expect(exported).not.toContain('BufferGeometry');
    expect(Object.keys(viewer).sort()).toEqual([
      'destroy',
      'element',
      'focusEntity',
      'mode',
      'project',
      'setEra',
      'setProject',
    ]);
  });
});

describe('<starsilk-starmap>', () => {
  it('registers the custom element exactly once', () => {
    expect(registerStarsilkStarmap()).toBe(true);
    expect(registerStarsilkStarmap()).toBe(true);
    expect(customElements.get(STARSILK_STARMAP_TAG)).toBe(StarsilkStarmapElement);
  });

  it('mounts from attributes and exposes imperative controls', async () => {
    const json = serializeProject(createDemoProject());
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, text: async () => json })),
    );
    const navigated: string[] = [];
    const element = document.createElement(STARSILK_STARMAP_TAG) as StarsilkStarmapElement;
    element.setAttribute('mode', 'viewer');
    element.setAttribute('src', './data/starsilk-map.json');
    element.addEventListener('starsilk-navigate', (event) => {
      navigated.push((event as CustomEvent<{ entityId: string }>).detail.entityId);
    });
    document.body.append(element);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(element.handle).toBeTruthy();
    expect(element.handle!.project()?.title).toBe('STARSiLK DEMONSTRATION PLATE');

    element.setEra('bew-3');
    expect(element.handle!.project()!.entities.find((e) => e.id === 'galaxy-root')!.time).toEqual({
      mode: 'override',
      overrideValue: 'bew-3',
    });

    expect(element.focusEntity('system-fallenstar')).toBe(true);
    expect(navigated).toContain('system-fallenstar');

    element.remove();
    expect(element.handle).toBeNull();
    handle = null;
  });

  it('surfaces a bad document as a starsilk-error event', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, text: async () => '{ not json' })),
    );
    const messages: string[] = [];
    const element = document.createElement(STARSILK_STARMAP_TAG) as StarsilkStarmapElement;
    element.setAttribute('src', './broken.json');
    element.addEventListener('starsilk-error', (event) => {
      messages.push((event as CustomEvent<{ message: string }>).detail.message);
    });
    document.body.append(element);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(messages.join(' ')).toMatch(/JSON parse failed/);
    element.remove();
    handle = null;
  });
});
