# 🛺 El Dayli-cio

App de control diario de recaudación para la flota de triciclos eléctricos de la familia. Cualquier familiar puede registrar cada día si un vehículo trabajó y cuánto recaudó; si algún vehículo se queda sin registrar, la app manda un correo de recordatorio automático por la noche especificando cuál.

Desarrollado por 爪丨匚卄乇.studios.

## Qué incluye

- **Backend:** Node.js + Express
- **Base de datos:** SQLite nativo de Node (`node:sqlite`) — no requiere compilar nada, cero problemas de permisos en Windows. Los datos se guardan en un archivo `.db` que **nunca se borra** salvo que tú lo borres.
- **Correos automáticos:** Nodemailer, con lista de destinatarios configurable desde la propia app. El correo lista exactamente qué vehículo(s) faltan por registrar ese día.
- **Multi-vehículo:** agrega tantos triciclos/vehículos como tenga el negocio, cada uno con su propio registro diario.
- **Registro familiar compartido:** el registro es **por vehículo, no por persona** — un solo registro por vehículo y día, que cualquier familiar puede llenar o corregir. El nombre de quién registró se guarda solo como dato informativo, sin contraseñas.
- **Frontend:** HTML/CSS/JS sin frameworks, con un medidor animado tipo tablero y tarjetas de estado por vehículo.

## Cómo funciona el registro compartido

- Cada **vehículo** tiene como máximo un registro por día (monto, si trabajó, notas).
- Cualquier familiar puede entrar y llenar el registro de cualquier vehículo. Si dos familiares registran el mismo vehículo el mismo día, el segundo **corrige** el dato del primero — no se duplica.
- El selector "Quién registra" es opcional y solo queda guardado como referencia de quién hizo la última actualización.
- Por la noche, la app revisa vehículo por vehículo. Si el Triciclo A ya se registró pero el Triciclo B no, el correo avisa específicamente que falta el Triciclo B.
