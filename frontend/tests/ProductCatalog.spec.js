import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, createLocalVue } from '@vue/test-utils';
import Vuetify from 'vuetify';
import ProductCatalog from '@/components/ProductCatalog.vue';
import productService from '@/services/productService';

vi.mock('@/services/productService', () => ({
  default: { search: vi.fn(), remove: vi.fn() },
}));

const localVue = createLocalVue();

const PRODUCTS = [
  { id: 1, name: 'Coca-Cola 600 ml', barcode: '7501055300013', price: '18.50', description: null },
  { id: 2, name: 'Agua natural 1 L', barcode: '7501030000015', price: '14.00', description: null },
];

const searchResult = (items = PRODUCTS) => ({
  items,
  pagination: { total: items.length, limit: 20, offset: 0, hasMore: false },
});

function mountCatalog() {
  return mount(ProductCatalog, {
    localVue,
    vuetify: new Vuetify(),
    stubs: { ProductFormDialog: true },
    attachTo: document.body,
  });
}

describe('ProductCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    productService.search.mockResolvedValue(searchResult());
  });

  it('carga el catálogo al montarse', async () => {
    const wrapper = mountCatalog();
    await vi.waitFor(() => expect(wrapper.vm.products).toHaveLength(2));

    expect(productService.search).toHaveBeenCalledWith(expect.objectContaining({ query: '' }));
    wrapper.destroy();
  });

  it('agrupa las pulsaciones de teclado en una sola búsqueda (debounce)', async () => {
    vi.useFakeTimers();
    const wrapper = mountCatalog();
    productService.search.mockClear();

    wrapper.vm.query = 'c';
    wrapper.vm.query = 'co';
    wrapper.vm.query = 'coc';
    await wrapper.vm.$nextTick();

    expect(productService.search).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(productService.search).toHaveBeenCalledTimes(1);
    expect(productService.search).toHaveBeenCalledWith(expect.objectContaining({ query: 'coc' }));

    vi.useRealTimers();
    wrapper.destroy();
  });

  it('emite add-to-sale al elegir un producto de la lista', async () => {
    const wrapper = mountCatalog();
    await vi.waitFor(() => expect(wrapper.vm.products).toHaveLength(2));

    wrapper.vm.addToSale(PRODUCTS[0]);

    expect(wrapper.emitted('add-to-sale')[0][0]).toEqual(PRODUCTS[0]);
    wrapper.destroy();
  });

  it('con Enter y código de barras exacto agrega el producto y limpia el campo', async () => {
    const wrapper = mountCatalog();
    await vi.waitFor(() => expect(wrapper.vm.products).toHaveLength(2));

    wrapper.vm.query = '7501030000015';
    wrapper.vm.handleEnter();

    expect(wrapper.emitted('add-to-sale')[0][0].id).toBe(2);
    expect(wrapper.vm.query).toBe('');
    wrapper.destroy();
  });

  it('con Enter y un único resultado agrega ese producto', async () => {
    productService.search.mockResolvedValue(searchResult([PRODUCTS[0]]));
    const wrapper = mountCatalog();
    await vi.waitFor(() => expect(wrapper.vm.products).toHaveLength(1));

    wrapper.vm.query = 'coca';
    wrapper.vm.handleEnter();

    expect(wrapper.emitted('add-to-sale')[0][0].id).toBe(1);
    wrapper.destroy();
  });

  it('con Enter y varios resultados no agrega nada', async () => {
    const wrapper = mountCatalog();
    await vi.waitFor(() => expect(wrapper.vm.products).toHaveLength(2));

    wrapper.vm.query = 'a';
    wrapper.vm.handleEnter();

    expect(wrapper.emitted('add-to-sale')).toBeUndefined();
    wrapper.destroy();
  });

  it('descarta respuestas de búsquedas obsoletas que llegan fuera de orden', async () => {
    const wrapper = mountCatalog();
    await vi.waitFor(() => expect(wrapper.vm.products).toHaveLength(2));

    // La primera búsqueda tarda; la segunda responde antes.
    let resolveSlow;
    productService.search.mockImplementationOnce(
      () => new Promise((resolve) => { resolveSlow = resolve; }),
    );
    const slow = wrapper.vm.fetchProducts();

    productService.search.mockResolvedValueOnce(searchResult([PRODUCTS[1]]));
    await wrapper.vm.fetchProducts();

    resolveSlow(searchResult(PRODUCTS));
    await slow;

    // Gana la última búsqueda lanzada, no la última en responder.
    expect(wrapper.vm.products).toHaveLength(1);
    expect(wrapper.vm.products[0].id).toBe(2);
    wrapper.destroy();
  });

  it('muestra el mensaje de error cuando falla la búsqueda', async () => {
    productService.search.mockRejectedValue(new Error('No se pudo conectar con el servidor'));
    const wrapper = mountCatalog();

    await vi.waitFor(() => expect(wrapper.vm.errorMessage).toBe('No se pudo conectar con el servidor'));
    expect(wrapper.emitted('error')).toBeTruthy();
    wrapper.destroy();
  });
});
