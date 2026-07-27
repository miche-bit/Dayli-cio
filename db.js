// db.js — Capa de datos de El Dayli-cio
// Usa el módulo nativo node:sqlite (Node >= 22.5). Cero dependencias nativas
// que compilar, así que en Windows no da problemas de permisos ni de build tools.

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

// Carpeta donde vive el archivo .db. En Railway, monta un Volume apuntando
// aquí (por ejemplo /data) para que los datos NO se borren en cada deploy.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'daylicio.db');
const db = new DatabaseSync(DB_PATH);

// PRAGMAs para mejor durabilidad y concurrencia con varios usuarios a la vez.
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA synchronous = NORMAL;');

db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE,
    activo INTEGER NOT NULL DEFAULT 1,
    creado_en TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS vehiculos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE,      -- ej: "Triciclo Rojo", "El de Papá"
    activo INTEGER NOT NULL DEFAULT 1,
    creado_en TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS registros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL,              -- 'YYYY-MM-DD'
    vehiculo_id INTEGER NOT NULL,
    usuario_id INTEGER,               -- quién de la familia registró (informativo)
    trabajo INTEGER NOT NULL,         -- 1 = trabajó, 0 = no trabajó
    monto REAL NOT NULL DEFAULT 0,    -- recaudación del día
    notas TEXT DEFAULT '',
    creado_en TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (vehiculo_id) REFERENCES vehiculos(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    UNIQUE (fecha, vehiculo_id)       -- un solo registro por vehículo por día (lo llena cualquier familiar)
  );

  CREATE TABLE IF NOT EXISTS correos_notificacion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    correo TEXT NOT NULL UNIQUE,
    activo INTEGER NOT NULL DEFAULT 1,
    creado_en TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notificaciones_enviadas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL,
    enviado_en TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (fecha)
  );

  CREATE INDEX IF NOT EXISTS idx_registros_fecha ON registros(fecha);
`);

// --- Migración automática para bases de datos creadas con la versión anterior ---
// (aquella donde "registros" tenía UNIQUE(fecha, usuario_id) y no existía vehiculo_id)
const columnas = db.prepare("PRAGMA table_info(registros)").all().map(c => c.name);
if (!columnas.includes('vehiculo_id')) {
  console.log('🔧 Migrando base de datos existente a la nueva estructura con vehículos...');
  db.exec(`
    ALTER TABLE registros RENAME TO registros_viejo;

    INSERT INTO vehiculos (nombre) VALUES ('Triciclo principal');

    CREATE TABLE registros (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      vehiculo_id INTEGER NOT NULL,
      usuario_id INTEGER,
      trabajo INTEGER NOT NULL,
      monto REAL NOT NULL DEFAULT 0,
      notas TEXT DEFAULT '',
      creado_en TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (vehiculo_id) REFERENCES vehiculos(id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
      UNIQUE (fecha, vehiculo_id)
    );

    INSERT INTO registros (id, fecha, vehiculo_id, usuario_id, trabajo, monto, notas, creado_en)
      SELECT id, fecha, (SELECT id FROM vehiculos WHERE nombre = 'Triciclo principal'),
             usuario_id, trabajo, monto, notas, creado_en
      FROM registros_viejo;

    DROP TABLE registros_viejo;

    CREATE INDEX IF NOT EXISTS idx_registros_fecha ON registros(fecha);
  `);
  console.log('✅ Migración completa. Se creó el vehículo "Triciclo principal" con tu historial anterior.');
}

// Seed opcional: si no hay ningún usuario ni vehículo, no se crea nada automático
// (salvo la migración de arriba). Se agregan desde la pantalla de Configuración.

module.exports = db;
