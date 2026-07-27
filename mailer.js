// mailer.js — Envío de correos de recordatorio con Nodemailer
require('dotenv').config();
const nodemailer = require('nodemailer');

function crearTransportador() {
  // Configurado para Gmail por defecto (usa una "Contraseña de aplicación",
  // no la contraseña normal de la cuenta). Se puede cambiar de proveedor
  // editando las variables de entorno en .env
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function enviarRecordatorio(correos, fechaLegible, vehiculosPendientes = []) {
  if (!correos.length) return { enviado: false, motivo: 'Sin correos configurados' };
  if (!vehiculosPendientes.length) return { enviado: false, motivo: 'Sin vehículos pendientes' };

  const listaHtml = vehiculosPendientes.map(nombre => `
    <li style="margin-bottom:6px; color:#fff;">🛺 ${nombre}</li>
  `).join('');

  const listaPlana = vehiculosPendientes.join(', ');

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log(`[MODO SIMULADO] Se enviaría recordatorio a: ${correos.join(', ')} — vehículos pendientes (${fechaLegible}): ${listaPlana}`);
    return { enviado: false, motivo: 'Faltan credenciales SMTP (modo simulado)' };
  }

  const transportador = crearTransportador();

  const palabraVehiculo = vehiculosPendientes.length === 1 ? 'vehículo' : 'vehículos';

  const html = `
  <div style="font-family: Segoe UI, Arial, sans-serif; background:#0f1115; padding:32px; color:#e8e8ec;">
    <div style="max-width:480px; margin:0 auto; background:#181b22; border-radius:16px; padding:32px; border:1px solid #2a2f3a;">
      <h1 style="color:#ffb703; font-size:22px; margin:0 0 8px;">🛺 El Dayli-cio</h1>
      <p style="font-size:15px; line-height:1.6; color:#c7c9d1;">
        El <strong style="color:#fff;">${fechaLegible}</strong> todavía tiene ${palabraVehiculo} sin registrar:
      </p>
      <ul style="font-size:15px; line-height:1.7; padding-left:20px; margin:14px 0;">
        ${listaHtml}
      </ul>
      <p style="font-size:15px; line-height:1.6; color:#c7c9d1;">
        Por favor entra a la app y registra cada vehículo, aunque sea para marcar que no hubo actividad ese día.
      </p>
      <div style="margin-top:24px; padding:14px 18px; background:#20242e; border-radius:10px; font-size:13px; color:#8b8f9c;">
        Este es un recordatorio automático diario de El Dayli-cio.
      </div>
    </div>
  </div>`;

  await transportador.sendMail({
    from: `"El Dayli-cio" <${process.env.SMTP_USER}>`,
    to: correos.join(', '),
    subject: `⚠️ ${vehiculosPendientes.length} ${palabraVehiculo} sin registrar hoy (${fechaLegible})`,
    html,
  });

  return { enviado: true };
}

module.exports = { enviarRecordatorio };
