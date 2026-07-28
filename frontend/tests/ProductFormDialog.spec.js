import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, createLocalVue } from '@vue/test-utils';
import Vuetify from 'vuetify';
import ProductFormDialog from '@/components/ProductFormDialog.vue';
import productService from '@/services/productService';
import { isValidEan13 } from '@/utils/barcode';

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
      imageUrl: null,
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
  it('propone un código de barras válido al abrir en modo alta', async () => {
    const wrapper = mountDialog();
    await wrapper.vm.$nextTick();

    // El campo es obligatorio y muchos artículos no traen código impreso.
    expect(wrapper.vm.form.barcode).toMatch(/^\d{13}$/);
    expect(isValidEan13(wrapper.vm.form.barcode)).toBe(true);
    wrapper.destroy();
  });

  it('el código propuesto usa el prefijo de El Salvador', async () => {
    const wrapper = mountDialog();
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.form.barcode.startsWith('741')).toBe(true);
    wrapper.destroy();
  });

  it('no toca el código al abrir en modo edición', async () => {
    const product = { id: 5, name: 'Coca', barcode: '7410010000015', price: '0.75', description: null };
    const wrapper = mountDialog({ product });
    await wrapper.vm.$nextTick();

    // Regenerarlo aquí cambiaría en silencio el código de un producto ya
    // etiquetado en el estante.
    expect(wrapper.vm.form.barcode).toBe('7410010000015');
    wrapper.destroy();
  });

  it('permite sustituir el código propuesto por otro', async () => {
    productService.create.mockResolvedValue({ id: 1, name: 'Propio' });
    const wrapper = mountDialog();
    await wrapper.vm.$nextTick();

    wrapper.vm.form = { name: 'Producto propio', barcode: 'INTERNO-042', price: '1.50', description: '' };
    await wrapper.vm.$nextTick();
    await wrapper.vm.submit();

    expect(productService.create).toHaveBeenCalledWith(expect.objectContaining({ barcode: 'INTERNO-042' }));
    wrapper.destroy();
  });

  it('genera un código distinto al pedir otro', async () => {
    const wrapper = mountDialog();
    await wrapper.vm.$nextTick();
    const primero = wrapper.vm.form.barcode;

    wrapper.vm.regenerarCodigo();

    expect(wrapper.vm.form.barcode).not.toBe(primero);
    expect(isValidEan13(wrapper.vm.form.barcode)).toBe(true);
    wrapper.destroy();
  });

  it('describe el código escrito sin bloquear el guardado', async () => {
    const wrapper = mountDialog();
    await wrapper.vm.$nextTick();

    wrapper.vm.form.barcode = '4006381333931';
    expect(wrapper.vm.pistaCodigo).toBe('EAN-13 válido');

    wrapper.vm.form.barcode = '4006381333932';
    expect(wrapper.vm.pistaCodigo).toMatch(/verificador/);

    // Un comercio puede usar códigos internos: se informa, no se rechaza.
    wrapper.vm.form.barcode = 'INTERNO-7';
    expect(wrapper.vm.pistaCodigo).toMatch(/propio/);
    wrapper.destroy();
  });
});
