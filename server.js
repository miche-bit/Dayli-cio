// server.js — El Dayli-cio: servidor Express + API REST
require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./db');
const { iniciarCron, revisarYNotificar } = require('./cron');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- USUARIOS ----------

app.get('/api/usuarios', (req, res) => {
  const usuarios = db.prepare('SELECT id, nombre, activo FROM usuarios WHERE activo = 1 ORDER BY nombre').all();
  res.json(usuarios);
});

app.post('/api/usuarios', (req, res) => {
  const { nombre } = req.body;
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
  try {
    const info = db.prepare('INSERT INTO usuarios (nombre) VALUES (?)').run(nombre.trim());
    res.status(201).json({ id: Number(info.lastInsertRowid), nombre: nombre.trim() });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ese usuario ya existe' });
    }
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

app.delete('/api/usuarios/:id', (req, res) => {
  db.prepare('UPDATE usuarios SET activo = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- VEHÍCULOS ----------

app.get('/api/vehiculos', (req, res) => {
  const vehiculos = db.prepare('SELECT id, nombre, activo FROM vehiculos WHERE activo = 1 ORDER BY nombre').all();
  res.json(vehiculos);
});

app.post('/api/vehiculos', (req, res) => {
  const { nombre } = req.body;
  if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre del vehículo es obligatorio' });
  try {
    const info = db.prepare('INSERT INTO vehiculos (nombre) VALUES (?)').run(nombre.trim());
    res.status(201).json({ id: Number(info.lastInsertRowid), nombre: nombre.trim() });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ya existe un vehículo con ese nombre' });
    }
    res.status(500).json({ error: 'Error al crear el vehículo' });
  }
});

app.delete('/api/vehiculos/:id', (req, res) => {
  db.prepare('UPDATE vehiculos SET activo = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- CORREOS DE NOTIFICACIÓN ----------

app.get('/api/correos', (req, res) => {
  const correos = db.prepare('SELECT id, correo, activo FROM correos_notificacion ORDER BY creado_en').all();
  res.json(correos);
});

app.post('/api/correos', (req, res) => {
  const { correo } = req.body;
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!correo || !regex.test(correo)) return res.status(400).json({ error: 'Correo inválido' });
  try {
    const info = db.prepare('INSERT INTO correos_notificacion (correo) VALUES (?)').run(correo.trim().toLowerCase());
    res.status(201).json({ id: Number(info.lastInsertRowid), correo });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Ese correo ya está en la lista' });
    }
    res.status(500).json({ error: 'Error al guardar correo' });
  }
});

app.delete('/api/correos/:id', (req, res) => {
  db.prepare('DELETE FROM correos_notificacion WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- REGISTROS DIARIOS ----------

// Crea o actualiza el registro de un día (idempotente: un registro por VEHÍCULO/día,
// sin importar cuál familiar lo llene — el último que lo guarda corrige el anterior)
app.post('/api/registros', (req, res) => {
  const { fecha, vehiculo_id, usuario_id, trabajo, monto, notas } = req.body;

  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return res.status(400).json({ error: 'Fecha inválida, formato esperado YYYY-MM-DD' });
  }
  if (!vehiculo_id) return res.status(400).json({ error: 'Falta vehiculo_id' });

  const trabajoInt = trabajo ? 1 : 0;
  const montoFinal = trabajoInt ? Number(monto) || 0 : 0;

  if (trabajoInt && (montoFinal < 0)) {
    return res.status(400).json({ error: 'El monto no puede ser negativo' });
  }

  try {
    db.prepare(`
      INSERT INTO registros (fecha, vehiculo_id, usuario_id, trabajo, monto, notas)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(fecha, vehiculo_id) DO UPDATE SET
        usuario_id = excluded.usuario_id,
        trabajo = excluded.trabajo,
        monto = excluded.monto,
        notas = excluded.notas
    `).run(fecha, vehiculo_id, usuario_id || null, trabajoInt, montoFinal, notas || '');

    res.status(201).json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al guardar el registro' });
  }
});

// Lista de registros, con filtros opcionales de rango de fechas
app.get('/api/registros', (req, res) => {
  const { desde, hasta } = req.query;
  let sql = `
    SELECT r.id, r.fecha, r.trabajo, r.monto, r.notas,
           v.nombre AS vehiculo,
           u.nombre AS usuario
    FROM registros r
    JOIN vehiculos v ON v.id = r.vehiculo_id
    LEFT JOIN usuarios u ON u.id = r.usuario_id
  `;
  const params = [];
  if (desde && hasta) {
    sql += ' WHERE r.fecha BETWEEN ? AND ?';
    params.push(desde, hasta);
  }
  sql += ' ORDER BY r.fecha DESC';
  const registros = db.prepare(sql).all(...params);
  res.json(registros);
});

// Resumen / estadísticas para el dashboard
app.get('/api/resumen', (req, res) => {
  const hoy = new Date().toLocaleDateString('en-CA');

  const totalMes = db.prepare(`
    SELECT COALESCE(SUM(monto), 0) AS total
    FROM registros
    WHERE strftime('%Y-%m', fecha) = strftime('%Y-%m', 'now')
  `).get().total;

  const diasTrabajadosMes = db.prepare(`
    SELECT COUNT(*) AS n FROM registros
    WHERE strftime('%Y-%m', fecha) = strftime('%Y-%m', 'now') AND trabajo = 1
  `).get().n;

  const montoHoyTotal = db.prepare(`
    SELECT COALESCE(SUM(monto), 0) AS total FROM registros WHERE fecha = ?
  `).get(hoy).total;

  // Estado de cada vehículo activo para el día de hoy: registrado o pendiente
  const vehiculosEstadoHoy = db.prepare('SELECT id, nombre FROM vehiculos WHERE activo = 1 ORDER BY nombre').all()
    .map(v => {
      const reg = db.prepare('SELECT trabajo, monto FROM registros WHERE fecha = ? AND vehiculo_id = ?').get(hoy, v.id);
      return {
        id: v.id,
        nombre: v.nombre,
        registrado: Boolean(reg),
        trabajo: reg ? Boolean(reg.trabajo) : null,
        monto: reg ? reg.monto : 0,
      };
    });

  const ultimos7 = db.prepare(`
    SELECT fecha, SUM(monto) AS total
    FROM registros
    WHERE fecha >= date('now', '-6 days')
    GROUP BY fecha
    ORDER BY fecha ASC
  `).all();

  const promedioDiaTrabajado = diasTrabajadosMes > 0 ? totalMes / diasTrabajadosMes : 0;

  res.json({
    totalMes,
    diasTrabajadosMes,
    promedioDiaTrabajado,
    montoHoyTotal,
    vehiculosEstadoHoy,
    ultimos7,
  });
});

// Vista de calendario: estado combinado de todos los vehículos, día por día, para un mes dado
app.get('/api/calendario', (req, res) => {
  const { anio, mes } = req.query; // mes: 1-12

  if (!anio || !mes || isNaN(anio) || isNaN(mes) || mes < 1 || mes > 12) {
    return res.status(400).json({ error: 'Parámetros anio y mes son obligatorios (mes entre 1 y 12)' });
  }

  const mesStr = String(mes).padStart(2, '0');
  const prefijo = `${anio}-${mesStr}`;

  const vehiculosActivos = db.prepare('SELECT id FROM vehiculos WHERE activo = 1').all();
  const totalVehiculos = vehiculosActivos.length;

  const filas = db.prepare(`
    SELECT fecha,
           COUNT(*) AS vehiculos_registrados,
           SUM(trabajo) AS vehiculos_trabajaron,
           SUM(monto) AS total_dia
    FROM registros
    WHERE fecha LIKE ? AND vehiculo_id IN (SELECT id FROM vehiculos WHERE activo = 1)
    GROUP BY fecha
  `).all(`${prefijo}-%`);

  const porFecha = {};
  filas.forEach(f => {
    let estado;
    if (f.vehiculos_registrados === 0) {
      estado = 'sin_registrar';
    } else if (f.vehiculos_registrados < totalVehiculos) {
      estado = 'parcial'; // faltan uno o más vehículos por registrar ese día
    } else if (f.vehiculos_trabajaron > 0) {
      estado = 'trabajado'; // todos registrados, al menos uno trabajó
    } else {
      estado = 'no_trabajado'; // todos registrados, ninguno trabajó
    }
    porFecha[f.fecha] = {
      estado,
      total: f.total_dia || 0,
      vehiculosRegistrados: f.vehiculos_registrados,
      vehiculosTotal: totalVehiculos,
    };
  });

  res.json({ totalVehiculos, dias: porFecha });
});

// Endpoint manual para forzar la revisión/envío del recordatorio (pruebas)
app.post('/api/notificar-ahora', async (req, res) => {
  await revisarYNotificar();
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`🛺 El Dayli-cio corriendo en http://localhost:${PORT}`);
  iniciarCron();
});
