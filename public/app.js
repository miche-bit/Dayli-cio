// app.js — Lógica de frontend de El Dayli-cio (vanilla JS, sin dependencias)

const CIRCUNFERENCIA = 2 * Math.PI * 90; // r=90

let trabajoSeleccionado = null; // true/false
let usuarios = [];

// ---------- Utilidades ----------

function hoyISO() {
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
}

function formatoMoneda(n) {
  return '$' + Number(n || 0).toLocaleString('es-ES', { maximumFractionDigits: 2 });
}

function mostrarToast(mensaje, esError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = mensaje;
  toast.classList.toggle('error', esError);
  toast.classList.add('mostrar');
  setTimeout(() => toast.classList.remove('mostrar'), 3200);
}

async function api(ruta, opciones = {}) {
  const res = await fetch(ruta, {
    headers: { 'Content-Type': 'application/json' },
    ...opciones,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error de red');
  return data;
}

// ---------- Medidor animado ----------

function actualizarMedidor(monto, montoMaxReferencia, trabajo) {
  const arco = document.getElementById('arcoMedidor');
  const porcentaje = montoMaxReferencia > 0 ? Math.min(monto / montoMaxReferencia, 1) : 0;
  const offset = CIRCUNFERENCIA - porcentaje * CIRCUNFERENCIA;

  requestAnimationFrame(() => {
    arco.style.strokeDashoffset = trabajo ? offset : CIRCUNFERENCIA;
  });

  document.getElementById('montoHoy').textContent = formatoMoneda(monto);

  const estadoEl = document.getElementById('estadoHoy');
  if (trabajo === null) {
    estadoEl.textContent = 'sin registrar';
    estadoEl.className = 'estado-hoy no';
  } else if (trabajo) {
    estadoEl.textContent = 'toda la flota al día ✓';
    estadoEl.className = 'estado-hoy si';
  } else {
    estadoEl.textContent = 'faltan vehículos por registrar';
    estadoEl.className = 'estado-hoy no';
  }
}

// ---------- Cargar datos iniciales ----------

async function cargarUsuarios() {
  usuarios = await api('/api/usuarios');
  const select = document.getElementById('selectUsuario');
  const opcionVacia = '<option value="">— sin especificar —</option>';
  select.innerHTML = usuarios.length
    ? opcionVacia + usuarios.map(u => `<option value="${u.id}">${u.nombre}</option>`).join('')
    : '<option value="">Sin familiares agregados aún</option>';

  const configDiv = document.getElementById('listaUsuariosConfig');
  configDiv.innerHTML = usuarios.map(u => `
    <div class="fila-config-item">
      <span>${u.nombre}</span>
      <button data-id="${u.id}" class="btn-borrar-usuario" title="Eliminar">✕</button>
    </div>
  `).join('') || '<div class="fila-config-item" style="color:var(--texto-tenue)">Ningún usuario aún</div>';

  document.querySelectorAll('.btn-borrar-usuario').forEach(btn => {
    btn.addEventListener('click', async () => {
      await api(`/api/usuarios/${btn.dataset.id}`, { method: 'DELETE' });
      mostrarToast('Usuario eliminado');
      cargarUsuarios();
    });
  });
}

async function cargarVehiculos() {
  const vehiculos = await api('/api/vehiculos');

  const select = document.getElementById('selectVehiculo');
  select.innerHTML = vehiculos.map(v => `<option value="${v.id}">${v.nombre}</option>`).join('')
    || '<option value="">Sin vehículos — agrega uno abajo</option>';

  const configDiv = document.getElementById('listaVehiculosConfig');
  configDiv.innerHTML = vehiculos.map(v => `
    <div class="fila-config-item">
      <span>🛺 ${v.nombre}</span>
      <button data-id="${v.id}" class="btn-borrar-vehiculo" title="Eliminar">✕</button>
    </div>
  `).join('') || '<div class="fila-config-item" style="color:var(--texto-tenue)">Ningún vehículo aún</div>';

  document.querySelectorAll('.btn-borrar-vehiculo').forEach(btn => {
    btn.addEventListener('click', async () => {
      await api(`/api/vehiculos/${btn.dataset.id}`, { method: 'DELETE' });
      mostrarToast('Vehículo eliminado');
      cargarVehiculos();
    });
  });
}

async function cargarCorreos() {
  const correos = await api('/api/correos');
  const configDiv = document.getElementById('listaCorreosConfig');
  configDiv.innerHTML = correos.map(c => `
    <div class="fila-config-item">
      <span>${c.correo}</span>
      <button data-id="${c.id}" class="btn-borrar-correo" title="Eliminar">✕</button>
    </div>
  `).join('') || '<div class="fila-config-item" style="color:var(--texto-tenue)">Ningún correo aún</div>';

  document.querySelectorAll('.btn-borrar-correo').forEach(btn => {
    btn.addEventListener('click', async () => {
      await api(`/api/correos/${btn.dataset.id}`, { method: 'DELETE' });
      mostrarToast('Correo eliminado');
      cargarCorreos();
    });
  });
}

async function cargarResumen() {
  const resumen = await api('/api/resumen');

  document.getElementById('statTotalMes').textContent = formatoMoneda(resumen.totalMes);
  document.getElementById('statDias').textContent = resumen.diasTrabajadosMes;
  document.getElementById('statPromedio').textContent = formatoMoneda(resumen.promedioDiaTrabajado);

  const maxReferencia = Math.max(...resumen.ultimos7.map(r => r.total || 0), 100);

  const vehiculos = resumen.vehiculosEstadoHoy || [];
  const todosRegistrados = vehiculos.length > 0 && vehiculos.every(v => v.registrado);
  const ningunoRegistrado = vehiculos.every(v => !v.registrado);

  if (vehiculos.length === 0) {
    actualizarMedidor(0, maxReferencia, null);
  } else if (ningunoRegistrado) {
    actualizarMedidor(0, maxReferencia, null);
  } else {
    // Mostramos el total recaudado hoy entre toda la flota, aunque falte algún vehículo
    actualizarMedidor(resumen.montoHoyTotal, maxReferencia, todosRegistrados);
  }

  // Tarjetas de estado por vehículo
  const cont = document.getElementById('listaVehiculosHoy');
  if (!vehiculos.length) {
    cont.innerHTML = '<div class="vacio">Agrega un vehículo en Configuración para empezar a registrar.</div>';
  } else {
    cont.innerHTML = vehiculos.map(v => `
      <div class="tarjeta-vehiculo ${v.registrado ? 'al-dia' : 'pendiente'}">
        <div class="nombre-veh">🛺 ${v.nombre}</div>
        ${v.registrado
          ? `<div class="monto-veh mono">${v.trabajo ? formatoMoneda(v.monto) : '— no trabajó —'}</div>
             <div class="estado-veh">registrado ✓</div>`
          : `<div class="monto-veh mono" style="color:var(--texto-tenue)">—</div>
             <div class="estado-veh">pendiente hoy</div>`
        }
      </div>
    `).join('');
  }
}

async function cargarHistorial() {
  const registros = await api('/api/registros');
  const lista = document.getElementById('listaRegistros');

  if (!registros.length) {
    lista.innerHTML = '<div class="vacio">Todavía no hay registros. Cuando guardes el primero, aparecerá aquí.</div>';
    return;
  }

  lista.innerHTML = registros.slice(0, 30).map((r, i) => {
    const fechaBonita = new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    return `
      <div class="fila-registro" style="animation-delay:${i * 0.03}s">
        <div class="izq">
          <span class="punto ${r.trabajo ? 'si' : 'no'}"></span>
          <div>
            <div class="fecha-reg">${fechaBonita} · 🛺 ${r.vehiculo}</div>
            <div class="usuario-reg">${r.usuario ? 'registró: ' + r.usuario : ''}</div>
          </div>
        </div>
        ${r.notas ? `<div class="notas-reg">${escaparHtml(r.notas)}</div>` : ''}
        <div class="monto-reg ${r.monto === 0 ? 'cero' : ''} mono">
          ${r.trabajo ? formatoMoneda(r.monto) : '— no trabajó —'}
        </div>
      </div>
    `;
  }).join('');
}

function escaparHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Formulario de registro ----------

function seleccionarTrabajo(valor) {
  trabajoSeleccionado = valor;
  document.getElementById('btnSi').classList.toggle('activo', valor === true);
  document.getElementById('btnNo').classList.toggle('activo', valor === false);
  document.getElementById('camposMonto').style.display = valor === false ? 'none' : 'block';
}

document.getElementById('btnSi').addEventListener('click', () => seleccionarTrabajo(true));
document.getElementById('btnNo').addEventListener('click', () => seleccionarTrabajo(false));

document.getElementById('btnGuardar').addEventListener('click', async () => {
  const vehiculoId = document.getElementById('selectVehiculo').value;
  const usuarioId = document.getElementById('selectUsuario').value;
  const boton = document.getElementById('btnGuardar');

  if (!vehiculoId) return mostrarToast('Primero agrega un vehículo en Configuración', true);
  if (trabajoSeleccionado === null) return mostrarToast('Indica si el vehículo trabajó hoy o no', true);

  const monto = trabajoSeleccionado ? Number(document.getElementById('inputMonto').value) || 0 : 0;
  const notas = document.getElementById('inputNotas').value;

  boton.disabled = true;
  boton.textContent = 'Guardando…';

  try {
    await api('/api/registros', {
      method: 'POST',
      body: JSON.stringify({
        fecha: hoyISO(),
        vehiculo_id: Number(vehiculoId),
        usuario_id: usuarioId ? Number(usuarioId) : null,
        trabajo: trabajoSeleccionado,
        monto,
        notas,
      }),
    });
    mostrarToast('Registro guardado ✓');
    document.getElementById('inputNotas').value = '';
    document.getElementById('inputMonto').value = '';
    seleccionarTrabajo(null);
    await Promise.all([cargarResumen(), cargarHistorial(), cargarCalendario()]);
  } catch (e) {
    mostrarToast(e.message, true);
  } finally {
    boton.disabled = false;
    boton.textContent = 'Guardar registro de hoy';
  }
});

// ---------- Configuración: usuarios y correos ----------

document.getElementById('btnAgregarVehiculo').addEventListener('click', async () => {
  const input = document.getElementById('inputNuevoVehiculo');
  const nombre = input.value.trim();
  if (!nombre) return;
  try {
    await api('/api/vehiculos', { method: 'POST', body: JSON.stringify({ nombre }) });
    input.value = '';
    mostrarToast('Vehículo añadido ✓');
    await Promise.all([cargarVehiculos(), cargarResumen()]);
  } catch (e) {
    mostrarToast(e.message, true);
  }
});

document.getElementById('btnAgregarUsuario').addEventListener('click', async () => {
  const input = document.getElementById('inputNuevoUsuario');
  const nombre = input.value.trim();
  if (!nombre) return;
  try {
    await api('/api/usuarios', { method: 'POST', body: JSON.stringify({ nombre }) });
    input.value = '';
    mostrarToast('Usuario añadido ✓');
    cargarUsuarios();
  } catch (e) {
    mostrarToast(e.message, true);
  }
});

document.getElementById('btnAgregarCorreo').addEventListener('click', async () => {
  const input = document.getElementById('inputNuevoCorreo');
  const correo = input.value.trim();
  if (!correo) return;
  try {
    await api('/api/correos', { method: 'POST', body: JSON.stringify({ correo }) });
    input.value = '';
    mostrarToast('Correo añadido ✓');
    cargarCorreos();
  } catch (e) {
    mostrarToast(e.message, true);
  }
});

// ---------- Calendario mensual ----------

let calendarioAnio, calendarioMes; // mes: 1-12

function iniciarCalendarioEnMesActual() {
  const hoy = new Date();
  calendarioAnio = hoy.getFullYear();
  calendarioMes = hoy.getMonth() + 1;
}

const NOMBRES_MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

async function cargarCalendario() {
  document.getElementById('calendarioTitulo').textContent = `${NOMBRES_MESES[calendarioMes - 1]} ${calendarioAnio}`;

  const data = await api(`/api/calendario?anio=${calendarioAnio}&mes=${calendarioMes}`);
  const cont = document.getElementById('calendarioDias');

  const primerDiaMes = new Date(calendarioAnio, calendarioMes - 1, 1);
  const ultimoDiaMes = new Date(calendarioAnio, calendarioMes, 0);
  const totalDias = ultimoDiaMes.getDate();

  // getDay(): 0=domingo..6=sabado. Queremos que la semana empiece en lunes.
  let offsetInicio = primerDiaMes.getDay() - 1;
  if (offsetInicio < 0) offsetInicio = 6;

  const hoyISOStr = hoyISO();
  let html = '';

  for (let i = 0; i < offsetInicio; i++) {
    html += '<div class="celda-dia vacia"></div>';
  }

  for (let dia = 1; dia <= totalDias; dia++) {
    const fechaStr = `${calendarioAnio}-${String(calendarioMes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
    const info = data.dias[fechaStr];
    const estado = info ? info.estado : 'sin_registrar';
    const esHoy = fechaStr === hoyISOStr;

    html += `
      <div class="celda-dia ${estado} ${info ? 'tiene-datos' : ''} ${esHoy ? 'hoy' : ''}"
           title="${fechaStr}${info ? ' — ' + info.vehiculosRegistrados + '/' + info.vehiculosTotal + ' vehículos' : ''}">
        <span>${dia}</span>
        ${info && info.total > 0 ? `<span class="monto-celda">${formatoMoneda(info.total)}</span>` : ''}
      </div>
    `;
  }

  cont.innerHTML = html;
}

document.getElementById('btnMesAnterior').addEventListener('click', () => {
  calendarioMes--;
  if (calendarioMes < 1) { calendarioMes = 12; calendarioAnio--; }
  cargarCalendario();
});

document.getElementById('btnMesSiguiente').addEventListener('click', () => {
  calendarioMes++;
  if (calendarioMes > 12) { calendarioMes = 1; calendarioAnio++; }
  cargarCalendario();
});

// ---------- Inicio ----------

(async function iniciar() {
  seleccionarTrabajo(null);
  iniciarCalendarioEnMesActual();
  try {
    await Promise.all([cargarVehiculos(), cargarUsuarios(), cargarCorreos(), cargarResumen(), cargarHistorial(), cargarCalendario()]);
  } catch (e) {
    mostrarToast('Error al cargar datos: ' + e.message, true);
  }
})();
