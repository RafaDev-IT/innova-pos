import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, createLocalVue } from '@vue/test-utils';
import Vuetify from 'vuetify';
import ProductFormDialog from '@/components/ProductFormDialog.vue';
import productService from '@/services/productService';

vi.mock('@/services/productService', () => ({
  default: {
    create: vi.fn(),
    update: vi.fn(),
  },
}));

const localVue = createLocalVue();

function mountDialog(props = {}) {
  return mount(ProductFormDialog, {
    localVue,
    vuetify: new Vuetify(),
    propsData: { value: true, product: null, ...props },
    // v-dialog renderiza en un portal; adjuntar al documento permite
    // consultar los inputs desde el test.
    attachTo: document.body,
  });
}

describe('ProductFormDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no envía nada si los campos obligatorios están vacíos', async () => {
    const wrapper = mountDialog();

    await wrapper.vm.submit();

    expect(productService.create).not.toHaveBeenCalled();
    wrapper.destroy();
  });

  it('crea el producto normalizando el precio a dos decimales', async () => {
    productService.create.mockResolvedValue({ id: 1, name: 'Agua', barcode: '750', price: '14.00' });
    const wrapper = mountDialog();

    wrapper.vm.form = { name: 'Agua 1 L', barcode: '7501030000015', price: '14', description: '' };
    await wrapper.vm.$nextTick();
    await wrapper.vm.submit();

    expect(productService.create).toHaveBeenCalledWith({
      name: 'Agua 1 L',
      barcode: '7501030000015',
      price: '14.00',
      description: null,
    });
    wrapper.destroy();
  });

  it('acepta precio con coma decimal', async () => {
    productService.create.mockResolvedValue({ id: 1, name: 'Agua' });
    const wrapper = mountDialog();

    wrapper.vm.form = { name: 'Agua 1 L', barcode: '7501030000015', price: '14,50', description: '' };
    await wrapper.vm.$nextTick();
    await wrapper.vm.submit();

    expect(productService.create).toHaveBeenCalledWith(expect.objectContaining({ price: '14.50' }));
    wrapper.destroy();
  });

  it('emite "saved" y cierra el diálogo tras guardar', async () => {
    const saved = { id: 9, name: 'Nuevo' };
    productService.create.mockResolvedValue(saved);
    const wrapper = mountDialog();

    wrapper.vm.form = { name: 'Nuevo', barcode: '123', price: '10', description: '' };
    await wrapper.vm.$nextTick();
    await wrapper.vm.submit();

    expect(wrapper.emitted('saved')[0][0]).toEqual(saved);
    expect(wrapper.emitted('input')).toContainEqual([false]);
    wrapper.destroy();
  });

  it('llama a update en lugar de create cuando recibe un producto', async () => {
    const product = { id: 5, name: 'Coca', barcode: '750', price: '18.50', description: null };
    productService.update.mockResolvedValue({ ...product, price: '20.00' });
    const wrapper = mountDialog({ product });

    wrapper.vm.form.price = '20';
    await wrapper.vm.$nextTick();
    await wrapper.vm.submit();

    expect(productService.update).toHaveBeenCalledWith(5, expect.objectContaining({ price: '20.00' }));
    expect(productService.create).not.toHaveBeenCalled();
    wrapper.destroy();
  });

  it('muestra los errores de validación del servidor en su campo', async () => {
    const error = new Error('conflicto');
    error.fieldErrors = { barcode: 'Ya lo usa otro producto' };
    productService.create.mockRejectedValue(error);
    const wrapper = mountDialog();

    wrapper.vm.form = { name: 'Duplicado', barcode: '123', price: '10', description: '' };
    await wrapper.vm.$nextTick();
    await wrapper.vm.submit();

    expect(wrapper.vm.serverErrors.barcode).toBe('Ya lo usa otro producto');
    // El diálogo permanece abierto para que el usuario corrija.
    expect(wrapper.emitted('saved')).toBeUndefined();
    wrapper.destroy();
  });

  it('muestra en la alerta general los errores sin campo asociado', async () => {
    const error = new Error('No se pudo conectar con el servidor');
    error.fieldErrors = {};
    productService.create.mockRejectedValue(error);
    const wrapper = mountDialog();

    wrapper.vm.form = { name: 'Producto', barcode: '123', price: '10', description: '' };
    await wrapper.vm.$nextTick();
    await wrapper.vm.submit();

    expect(wrapper.vm.generalError).toBe('No se pudo conectar con el servidor');
    wrapper.destroy();
  });
});
