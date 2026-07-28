import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, createLocalVue } from '@vue/test-utils';
import Vuetify from 'vuetify';
import SalePanel from '@/components/SalePanel.vue';
import saleService from '@/services/saleService';

vi.mock('@/services/saleService', () => ({
  default: { create: vi.fn() },
}));

const localVue = createLocalVue();

const COCA = { id: 1, name: 'Coca-Cola 600 ml', barcode: '7501055300013', price: '18.50' };
const AGUA = { id: 2, name: 'Agua natural 1 L', barcode: '7501030000015', price: '14.00' };

function mountPanel() {
  return mount(SalePanel, { localVue, vuetify: new Vuetify(), attachTo: document.body });
}

describe('SalePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inicia vacío y con total en cero', () => {
    const wrapper = mountPanel();

    expect(wrapper.vm.items).toHaveLength(0);
    expect(wrapper.vm.totalAmount).toBe('0.00');
    expect(wrapper.vm.canSave).toBe(false);
    wrapper.destroy();
  });

  it('agrega un producto con su nombre y su precio de catálogo', () => {
    const wrapper = mountPanel();

    wrapper.vm.addProduct(COCA);

    expect(wrapper.vm.items[0]).toMatchObject({ productId: 1, name: 'Coca-Cola 600 ml', unitPrice: '18.50', quantity: 1 });
    expect(wrapper.vm.totalAmount).toBe('18.50');
    wrapper.destroy();
  });

  it('acumula el total de varios productos', () => {
    const wrapper = mountPanel();

    wrapper.vm.addProduct(COCA);
    wrapper.vm.addProduct(AGUA);

    expect(wrapper.vm.totalAmount).toBe('32.50');
    expect(wrapper.vm.unitCount).toBe(2);
    wrapper.destroy();
  });

  it('incrementa la cantidad al reescanear el mismo producto en lugar de duplicar el renglón', () => {
    const wrapper = mountPanel();

    wrapper.vm.addProduct(COCA);
    wrapper.vm.addProduct(COCA);

    expect(wrapper.vm.items).toHaveLength(1);
    expect(wrapper.vm.items[0].quantity).toBe(2);
    expect(wrapper.vm.totalAmount).toBe('37.00');
    wrapper.destroy();
  });

  it('no fusiona con un renglón cuyo precio fue editado', () => {
    const wrapper = mountPanel();

    wrapper.vm.addProduct(COCA);
    wrapper.vm.updatePrice(0, '10.00');
    wrapper.vm.addProduct(COCA);

    expect(wrapper.vm.items).toHaveLength(2);
    expect(wrapper.vm.totalAmount).toBe('28.50');
    wrapper.destroy();
  });

  it('recalcula el total al editar el precio dentro de la venta', () => {
    const wrapper = mountPanel();
    wrapper.vm.addProduct(COCA);

    wrapper.vm.updatePrice(0, '20.00');

    expect(wrapper.vm.totalAmount).toBe('20.00');
    wrapper.destroy();
  });

  it('acepta precio con coma decimal al editar', () => {
    const wrapper = mountPanel();
    wrapper.vm.addProduct(COCA);

    wrapper.vm.updatePrice(0, '20,50');

    expect(wrapper.vm.totalAmount).toBe('20.50');
    wrapper.destroy();
  });

  it('marca el renglón y bloquea el guardado si el precio es inválido', () => {
    const wrapper = mountPanel();
    wrapper.vm.addProduct(COCA);

    wrapper.vm.updatePrice(0, '-5');

    expect(wrapper.vm.items[0].priceError).toBe('Precio inválido');
    expect(wrapper.vm.canSave).toBe(false);
    wrapper.destroy();
  });

  it('permite quitar un renglón de la venta', () => {
    const wrapper = mountPanel();
    wrapper.vm.addProduct(COCA);
    wrapper.vm.addProduct(AGUA);

    wrapper.vm.removeItem(0);

    expect(wrapper.vm.items).toHaveLength(1);
    expect(wrapper.vm.items[0].productId).toBe(2);
    expect(wrapper.vm.totalAmount).toBe('14.00');
    wrapper.destroy();
  });

  it('ajusta la cantidad sin bajar de una unidad', () => {
    const wrapper = mountPanel();
    wrapper.vm.addProduct(COCA);

    wrapper.vm.changeQuantity(0, 2);
    expect(wrapper.vm.items[0].quantity).toBe(3);

    wrapper.vm.changeQuantity(0, -10);
    expect(wrapper.vm.items[0].quantity).toBe(3);
    wrapper.destroy();
  });

  it('suma cien renglones sin arrastrar error de punto flotante', () => {
    const wrapper = mountPanel();
    for (let i = 0; i < 100; i += 1) {
      wrapper.vm.addProduct({ id: i + 1, name: `P${i}`, barcode: `${i}`, price: '0.07' });
    }

    expect(wrapper.vm.totalAmount).toBe('7.00');
    wrapper.destroy();
  });

  it('envía producto, precio y cantidad, sin el total', async () => {
    saleService.create.mockResolvedValue({ id: 1, folio: 'V-000001', total: '37.00', itemCount: 2 });
    const wrapper = mountPanel();
    wrapper.vm.addProduct(COCA);
    wrapper.vm.changeQuantity(0, 1);

    await wrapper.vm.save();

    expect(saleService.create).toHaveBeenCalledWith([{ productId: 1, unitPrice: '18.50', quantity: 2 }]);
    wrapper.destroy();
  });

  it('normaliza el precio editado a dos decimales antes de enviarlo', async () => {
    saleService.create.mockResolvedValue({ id: 1, folio: 'V-000001', total: '9.00', itemCount: 1 });
    const wrapper = mountPanel();
    wrapper.vm.addProduct(COCA);
    wrapper.vm.updatePrice(0, '9,5');

    await wrapper.vm.save();

    expect(saleService.create).toHaveBeenCalledWith([{ productId: 1, unitPrice: '9.50', quantity: 1 }]);
    wrapper.destroy();
  });

  it('vacía la venta y emite el evento tras guardar', async () => {
    const sale = { id: 7, folio: 'V-000007', total: '18.50', itemCount: 1 };
    saleService.create.mockResolvedValue(sale);
    const wrapper = mountPanel();
    wrapper.vm.addProduct(COCA);

    await wrapper.vm.save();

    expect(wrapper.vm.items).toHaveLength(0);
    expect(wrapper.vm.receipt.sale).toEqual(sale);
    expect(wrapper.emitted('saved')[0][0]).toEqual(sale);
    wrapper.destroy();
  });

  it('conserva la venta capturada si el guardado falla', async () => {
    saleService.create.mockRejectedValue(new Error('No se pudo conectar con el servidor'));
    const wrapper = mountPanel();
    wrapper.vm.addProduct(COCA);

    await wrapper.vm.save();

    // Perder el carrito ante un fallo de red obligaría a recapturar todo.
    expect(wrapper.vm.items).toHaveLength(1);
    expect(wrapper.vm.errorMessage).toBe('No se pudo conectar con el servidor');
    expect(wrapper.emitted('error')).toBeTruthy();
    wrapper.destroy();
  });

  it('no intenta guardar una venta vacía', async () => {
    const wrapper = mountPanel();

    await wrapper.vm.save();

    expect(saleService.create).not.toHaveBeenCalled();
    wrapper.destroy();
  });

  it('vacía la venta al confirmar el diálogo', () => {
    const wrapper = mountPanel();
    wrapper.vm.addProduct(COCA);

    wrapper.vm.clear();

    expect(wrapper.vm.items).toHaveLength(0);
    expect(wrapper.vm.totalAmount).toBe('0.00');
    wrapper.destroy();
  });
  it('no marca como ajustado un renglón que conserva el precio de catálogo', () => {
    const wrapper = mountPanel();
    wrapper.vm.addProduct(COCA);

    expect(wrapper.vm.isEdited(wrapper.vm.items[0])).toBe(false);
    expect(wrapper.vm.editedCount).toBe(0);
    wrapper.destroy();
  });

  it('marca el renglón como ajustado al cambiar su precio', () => {
    const wrapper = mountPanel();
    wrapper.vm.addProduct(COCA);

    wrapper.vm.updatePrice(0, '15.00');

    expect(wrapper.vm.isEdited(wrapper.vm.items[0])).toBe(true);
    expect(wrapper.vm.editedCount).toBe(1);
    wrapper.destroy();
  });

  it('deja de marcarlo si se devuelve al precio original', () => {
    const wrapper = mountPanel();
    wrapper.vm.addProduct(COCA);

    wrapper.vm.updatePrice(0, '15.00');
    wrapper.vm.updatePrice(0, '18.50');

    expect(wrapper.vm.isEdited(wrapper.vm.items[0])).toBe(false);
    wrapper.destroy();
  });

  it('no marca como ajustado un precio escrito con otro formato pero igual valor', () => {
    // "18,50" y "18.50" son el mismo importe: señalarlo como ajustado sería
    // una falsa alarma que resta credibilidad al indicador.
    const wrapper = mountPanel();
    wrapper.vm.addProduct(COCA);

    wrapper.vm.updatePrice(0, '18,50');

    expect(wrapper.vm.isEdited(wrapper.vm.items[0])).toBe(false);
    wrapper.destroy();
  });

  it('cuenta cuántos renglones llevan precio ajustado', () => {
    const wrapper = mountPanel();
    wrapper.vm.addProduct(COCA);
    wrapper.vm.addProduct(AGUA);

    wrapper.vm.updatePrice(0, '10.00');
    expect(wrapper.vm.editedCount).toBe(1);

    wrapper.vm.updatePrice(1, '12.00');
    expect(wrapper.vm.editedCount).toBe(2);
    wrapper.destroy();
  });

  it('conserva el precio de catálogo para poder mostrar cuál era', () => {
    const wrapper = mountPanel();
    wrapper.vm.addProduct(COCA);

    wrapper.vm.updatePrice(0, '5.00');

    expect(wrapper.vm.items[0].catalogPrice).toBe('18.50');
    wrapper.destroy();
  });
});
