// mailer.js — Envío de correos de recordatorio con Resend (API HTTPS)
//
// Se usa Resend en vez de SMTP/Nodemailer porque Railway (plan Hobby y
// planes inferiores) bloquea las conexiones salientes a los puertos SMTP
// (465, 587), lo que hace que el envío por Gmail se cuelgue con timeout.
// Resend envía el correo a través de una API HTTPS normal (igual que
// cualquier fetch), que no está bloqueada.
require('dotenv').config();
const { Resend } = require('resend');

function construirHtml(fechaLegible, vehiculosPendientes, palabraVehiculo) {
  const listaHtml = vehiculosPendientes.map(nombre => `
    <li style="margin-bottom:6px; color:#fff;">🛺 ${nombre}</li>
  `).join('');

  return `
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
}

async function enviarRecordatorio(correos, fechaLegible, vehiculosPendientes = []) {
  if (!correos.length) return { enviado: false, motivo: 'Sin correos configurados' };
  if (!vehiculosPendientes.length) return { enviado: false, motivo: 'Sin vehículos pendientes' };

  const palabraVehiculo = vehiculosPendientes.length === 1 ? 'vehículo' : 'vehículos';
  const listaPlana = vehiculosPendientes.join(', ');

  if (!process.env.RESEND_API_KEY) {
    console.log(`[MODO SIMULADO] Se enviaría recordatorio a: ${correos.join(', ')} — vehículos pendientes (${fechaLegible}): ${listaPlana}`);
    return { enviado: false, motivo: 'Falta RESEND_API_KEY (modo simulado)' };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const html = construirHtml(fechaLegible, vehiculosPendientes, palabraVehiculo);

  // Remitente: mientras no se verifique un dominio propio en Resend, hay
  // que usar exactamente esta dirección de prueba que Resend habilita
  // por defecto para todas las cuentas nuevas.
  const remitente = process.env.RESEND_FROM || 'El Dayli-cio <onboarding@resend.dev>';

  console.log(`[MAILER] Intentando enviar a: ${correos.join(', ')}...`);

  try {
    const { data, error } = await resend.emails.send({
      from: remitente,
      to: correos,
      subject: `⚠️ ${vehiculosPendientes.length} ${palabraVehiculo} sin registrar hoy (${fechaLegible})`,
      html,
    });

    if (error) {
      console.error('[MAILER] ERROR al enviar correo:', error.message || error);
      return { enviado: false, motivo: `Error Resend: ${error.message || JSON.stringify(error)}` };
    }

    console.log('[MAILER] Correo enviado con éxito, id:', data?.id);
    return { enviado: true };
  } catch (error) {
    console.error('[MAILER] ERROR inesperado al enviar correo:', error.message);
    return { enviado: false, motivo: `Error inesperado: ${error.message}` };
  }
}

module.exports = { enviarRecordatorio };
