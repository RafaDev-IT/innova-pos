import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * El tema por defecto es claro. Antes se heredaba del sistema operativo, lo que
 * hacía que la misma instalación se viera distinta en dos cajas según cómo
 * tuviera cada una Windows.
 */
describe('tema por defecto', () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });

  it('arranca en claro cuando el usuario no ha elegido', async () => {
    // Sistema en oscuro: da igual, debe salir claro.
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addListener: vi.fn(), removeListener: vi.fn() });
    const vuetify = (await import('@/plugins/vuetify')).default;
    expect(vuetify.userPreset.theme.dark).toBe(false);
  });

  it('respeta la elección guardada en oscuro', async () => {
    window.localStorage.setItem('innova-pos:theme', 'dark');
    const vuetify = (await import('@/plugins/vuetify')).default;
    expect(vuetify.userPreset.theme.dark).toBe(true);
  });

  it('respeta la elección guardada en claro', async () => {
    window.localStorage.setItem('innova-pos:theme', 'light');
    const vuetify = (await import('@/plugins/vuetify')).default;
    expect(vuetify.userPreset.theme.dark).toBe(false);
  });

  it('no rompe si localStorage está bloqueado', async () => {
    const orig = window.localStorage.getItem;
    window.localStorage.getItem = () => { throw new Error('bloqueado'); };
    const vuetify = (await import('@/plugins/vuetify')).default;
    expect(vuetify.userPreset.theme.dark).toBe(false);
    window.localStorage.getItem = orig;
  });
});
