// cron.js — Revisión diaria automática: ¿se registró el día de hoy?
const cron = require('node-cron');
const db = require('./db');
const { enviarRecordatorio } = require('./mailer');

function hoyISO() {
  // Fecha local en formato YYYY-MM-DD (usa TZ del proceso, configurable via .env TZ)
  const d = new Date();
  return d.toLocaleDateString('en-CA'); // en-CA da formato YYYY-MM-DD
}

async function revisarYNotificar() {
  const fecha = hoyISO();

  const yaNotificadoHoy = db.prepare('SELECT 1 FROM notificaciones_enviadas WHERE fecha = ?').get(fecha);
  if (yaNotificadoHoy) return;

  const vehiculos = db.prepare('SELECT id, nombre FROM vehiculos WHERE activo = 1').all();
  if (!vehiculos.length) return; // no hay vehículos configurados, nada que revisar

  const vehiculosSinRegistro = vehiculos.filter(v =>
    !db.prepare('SELECT 1 FROM registros WHERE fecha = ? AND vehiculo_id = ?').get(fecha, v.id)
  );

  if (!vehiculosSinRegistro.length) return; // todos los vehículos ya registraron el día

  const correos = db.prepare('SELECT correo FROM correos_notificacion WHERE activo = 1').all().map(r => r.correo);
  if (!correos.length) return;

  const fechaLegible = new Date(fecha + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const nombresVehiculos = vehiculosSinRegistro.map(v => v.nombre);
  const resultado = await enviarRecordatorio(correos, fechaLegible, nombresVehiculos);
  console.log(`[CRON ${new Date().toISOString()}] Recordatorio ${fecha} — vehículos pendientes: ${nombresVehiculos.join(', ')}:`, resultado);

  db.prepare('INSERT OR IGNORE INTO notificaciones_enviadas (fecha) VALUES (?)').run(fecha);
}

function iniciarCron() {
  // Corre todos los días a las 9:00 PM, hora del servidor (configurable con TZ en .env)
  const horario = process.env.CRON_SCHEDULE || '0 21 * * *';
  cron.schedule(horario, revisarYNotificar);
  console.log(`⏰ Cron de recordatorio activo: "${horario}" (revisa si falta el registro del día)`);
}

module.exports = { iniciarCron, revisarYNotificar };
