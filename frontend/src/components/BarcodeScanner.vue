<template>
  <v-dialog v-model="isOpen" max-width="520" persistent @keydown.esc="cerrar">
    <div class="dialog">
      <div class="dialog__head">
        <div class="dialog__icon dialog__icon--primary">
          <v-icon size="20" color="primary">mdi-barcode-scan</v-icon>
        </div>
        <div class="flex-grow-1">
          <div class="dialog__title">Escanear código</div>
          <div class="dialog__sub">{{ subtitulo }}</div>
        </div>
        <v-btn icon small @click="cerrar"><v-icon size="20">mdi-close</v-icon></v-btn>
      </div>

      <div class="dialog__body pt-0">
        <div class="scanner">
          <video ref="video" class="scanner__video" playsinline muted autoplay />

          <!-- Marco guía: sin él, el operador no sabe dónde poner el código. -->
          <div v-if="estado === 'escaneando'" class="scanner__frame">
            <span class="scanner__corner scanner__corner--tl" />
            <span class="scanner__corner scanner__corner--tr" />
            <span class="scanner__corner scanner__corner--bl" />
            <span class="scanner__corner scanner__corner--br" />
            <span class="scanner__laser" />
          </div>

          <div v-if="estado !== 'escaneando'" class="scanner__overlay">
            <template v-if="estado === 'iniciando'">
              <v-progress-circular indeterminate color="primary" size="34" width="3" />
              <p class="scanner__msg">Encendiendo la cámara…</p>
            </template>

            <template v-else-if="estado === 'error'">
              <v-icon size="34" color="error">mdi-camera-off-outline</v-icon>
              <p class="scanner__msg">{{ errorMessage }}</p>
              <v-btn small depressed class="btn-soft mt-2" @click="iniciar">Reintentar</v-btn>
            </template>

            <template v-else-if="estado === 'no-soportado'">
              <v-icon size="34" color="warning">mdi-alert-circle-outline</v-icon>
              <p class="scanner__msg">{{ errorMessage }}</p>
            </template>
          </div>
        </div>

        <!-- Alternativa por teclado, siempre disponible: una pistola lectora
             funciona como teclado y es más rápida que la cámara. Y si la cámara
             falla, el operador no se queda sin salida. -->
        <div class="scanner__manual">
          <v-text-field
            ref="manual"
            v-model="codigoManual"
            label="O escribe el código"
            outlined
            dense
            hide-details
            prepend-inner-icon="mdi-keyboard-outline"
            @keydown.enter="usarManual"
          />
          <v-btn depressed class="btn-primary ml-2" :disabled="!codigoManual.trim()" @click="usarManual">
            Usar
          </v-btn>
        </div>

        <div v-if="camaras.length > 1" class="mt-3">
          <v-select
            v-model="camaraActiva"
            :items="camaras"
            item-text="label"
            item-value="deviceId"
            label="Cámara"
            outlined
            dense
            hide-details
            @change="iniciar"
          />
        </div>
      </div>
    </div>
  </v-dialog>
</template>

<script>
/**
 * Lector de códigos de barras por cámara.
 *
 * Usa la API nativa BarcodeDetector cuando está disponible —Chrome y Edge en
 * escritorio y Android, que es el escenario habitual de una terminal de punto
 * de venta— porque no cuesta un solo kilobyte de dependencia y decodifica en
 * el hilo del navegador.
 *
 * Donde no existe, se carga ZXing bajo demanda. Es una librería de unos
 * doscientos kilobytes, así que se importa de forma diferida: quien tenga la
 * API nativa no la descarga nunca.
 *
 * La cámara exige contexto seguro: funciona en HTTPS y en localhost, pero no
 * en una IP de red por HTTP. El mensaje de error lo explica en lugar de dejar
 * un fallo mudo.
 */

// Formatos habituales en producto de tienda.
const FORMATOS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'];

export default {
  name: 'BarcodeScanner',

  props: {
    value: { type: Boolean, default: false },
  },

  data: () => ({
    estado: 'iniciando', // iniciando · escaneando · error · no-soportado
    errorMessage: '',
    codigoManual: '',
    camaras: [],
    camaraActiva: null,
    stream: null,
    detector: null,
    lectorZxing: null,
    temporizador: null,
  }),

  computed: {
    isOpen: {
      get() {
        return this.value;
      },
      set(val) {
        this.$emit('input', val);
      },
    },

    subtitulo() {
      return {
        iniciando: 'Preparando la cámara',
        escaneando: 'Coloca el código dentro del marco',
        error: 'No se pudo usar la cámara',
        'no-soportado': 'Lectura por cámara no disponible',
      }[this.estado];
    },
  },

  watch: {
    value(abierto) {
      if (abierto) this.iniciar();
      else this.detener();
    },
  },

  beforeDestroy() {
    this.detener();
  },

  methods: {
    async iniciar() {
      this.detener();
      this.estado = 'iniciando';
      this.errorMessage = '';

      if (!window.isSecureContext) {
        this.estado = 'no-soportado';
        this.errorMessage =
          'El navegador solo permite usar la cámara en conexiones seguras. Abre el sistema por HTTPS o desde este mismo equipo.';
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this.estado = 'no-soportado';
        this.errorMessage = 'Este navegador no permite acceder a la cámara.';
        return;
      }

      try {
        await this.abrirCamara();
        await this.prepararDecodificador();
        this.estado = 'escaneando';
        this.bucle();
      } catch (error) {
        this.estado = 'error';
        this.errorMessage = this.describirError(error);
      }
    },

    async abrirCamara() {
      const constraints = {
        video: this.camaraActiva
          ? { deviceId: { exact: this.camaraActiva } }
          : // La cámara trasera es la que apunta al producto en una tablet.
            { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.$refs.video.srcObject = this.stream;
      await this.$refs.video.play();

      // El listado de cámaras solo trae etiquetas después de conceder permiso.
      const dispositivos = await navigator.mediaDevices.enumerateDevices();
      this.camaras = dispositivos
        .filter((d) => d.kind === 'videoinput')
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Cámara ${i + 1}` }));

      if (!this.camaraActiva && this.stream.getVideoTracks()[0]) {
        this.camaraActiva = this.stream.getVideoTracks()[0].getSettings().deviceId || null;
      }
    },

    async prepararDecodificador() {
      if ('BarcodeDetector' in window) {
        const soportados = await window.BarcodeDetector.getSupportedFormats();
        this.detector = new window.BarcodeDetector({
          formats: FORMATOS.filter((f) => soportados.includes(f)),
        });
        return;
      }

      // Respaldo cargado solo cuando hace falta, para no penalizar a quien no
      // lo necesita con doscientos kilobytes de descarga.
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      this.lectorZxing = new BrowserMultiFormatReader();
    },

    bucle() {
      if (this.estado !== 'escaneando') return;

      // Se sondea cada 250 ms en lugar de en cada fotograma: decodificar a
      // sesenta por segundo calienta el equipo sin leer más rápido.
      this.temporizador = setTimeout(async () => {
        try {
          const codigo = await this.leerFotograma();
          if (codigo) return this.encontrado(codigo);
        } catch (error) {
          // Un fotograma ilegible es lo normal: se sigue intentando.
        }
        this.bucle();
      }, 250);
    },

    async leerFotograma() {
      const video = this.$refs.video;
      if (!video || video.readyState < 2) return null;

      if (this.detector) {
        const encontrados = await this.detector.detect(video);
        return encontrados.length ? encontrados[0].rawValue : null;
      }

      if (this.lectorZxing) {
        const resultado = await this.lectorZxing.decodeOnceFromVideoElement(video).catch(() => null);
        return resultado ? resultado.getText() : null;
      }

      return null;
    },

    encontrado(codigo) {
      const limpio = String(codigo).trim();
      if (!limpio) return this.bucle();

      // Una señal audible confirma la lectura sin obligar a mirar la pantalla.
      this.pitar();
      this.$emit('scanned', limpio);
      this.cerrar();
      return null;
    },

    usarManual() {
      const codigo = this.codigoManual.trim();
      if (!codigo) return;
      this.$emit('scanned', codigo);
      this.cerrar();
    },

    /** Pitido corto sintetizado: evita cargar un archivo de audio. */
    pitar() {
      try {
        const Contexto = window.AudioContext || window.webkitAudioContext;
        if (!Contexto) return;
        const ctx = new Contexto();
        const osc = ctx.createOscillator();
        const gan = ctx.createGain();
        osc.frequency.value = 1180;
        gan.gain.value = 0.06;
        osc.connect(gan).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.09);
        setTimeout(() => ctx.close(), 300);
      } catch (error) {
        // Sin audio disponible la lectura funciona igual.
      }
    },

    describirError(error) {
      const nombre = error && error.name;
      if (nombre === 'NotAllowedError') {
        return 'Permiso de cámara denegado. Actívalo en los ajustes del navegador y vuelve a intentarlo.';
      }
      if (nombre === 'NotFoundError' || nombre === 'DevicesNotFoundError') {
        return 'No se encontró ninguna cámara en este equipo.';
      }
      if (nombre === 'NotReadableError') {
        return 'La cámara está siendo usada por otra aplicación.';
      }
      return error && error.message ? error.message : 'No se pudo iniciar la cámara.';
    },

    detener() {
      clearTimeout(this.temporizador);
      this.temporizador = null;

      if (this.stream) {
        // Liberar cada pista apaga el testigo de la cámara: dejarlo encendido
        // tras cerrar el diálogo alarma al usuario con razón.
        this.stream.getTracks().forEach((pista) => pista.stop());
        this.stream = null;
      }

      if (this.$refs.video) this.$refs.video.srcObject = null;
      this.detector = null;
      this.lectorZxing = null;
    },

    cerrar() {
      this.detener();
      this.codigoManual = '';
      this.isOpen = false;
    },
  },
};
</script>

<style scoped>
.scanner {
  position: relative;
  aspect-ratio: 4 / 3;
  border-radius: var(--r-md);
  overflow: hidden;
  background: #0d1117;
}

.scanner__video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.scanner__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(13, 17, 23, 0.92);
  padding: 24px;
  text-align: center;
}

.scanner__msg {
  font-size: 0.8125rem;
  color: rgba(255, 255, 255, 0.86);
  line-height: 1.5;
  margin: 0;
  max-width: 320px;
}

.scanner__frame {
  position: absolute;
  left: 12%;
  right: 12%;
  top: 28%;
  bottom: 28%;
}

.scanner__corner {
  position: absolute;
  width: 26px;
  height: 26px;
  border: 3px solid var(--pos-primary);
}
.scanner__corner--tl {
  top: 0;
  left: 0;
  border-right: 0;
  border-bottom: 0;
  border-radius: 6px 0 0 0;
}
.scanner__corner--tr {
  top: 0;
  right: 0;
  border-left: 0;
  border-bottom: 0;
  border-radius: 0 6px 0 0;
}
.scanner__corner--bl {
  bottom: 0;
  left: 0;
  border-right: 0;
  border-top: 0;
  border-radius: 0 0 0 6px;
}
.scanner__corner--br {
  bottom: 0;
  right: 0;
  border-left: 0;
  border-top: 0;
  border-radius: 0 0 6px 0;
}

.scanner__laser {
  position: absolute;
  left: 6px;
  right: 6px;
  top: 50%;
  height: 2px;
  background: var(--pos-primary);
  box-shadow: 0 0 10px var(--pos-primary);
  animation: barrido 2.2s ease-in-out infinite;
}

@keyframes barrido {
  0%, 100% {
    transform: translateY(-38px);
  }
  50% {
    transform: translateY(38px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .scanner__laser {
    animation: none;
  }
}

.scanner__manual {
  display: flex;
  align-items: center;
  margin-top: 14px;
}
</style>
