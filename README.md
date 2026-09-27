# Parciales

App compartida para organizar tareas y parciales entre dos personas. Guarda los datos en Firebase (Firestore) y se hostea gratis en GitHub Pages.

## Archivos

- `index.html` — estructura de la página
- `style.css` — estilos (estilo cuaderno)
- `app.js` — toda la lógica
- `firebase-config.js` — la configuración de tu proyecto Firebase (ya tiene tus datos puestos)
- `firestore.rules` — reglas de seguridad para pegar en Firebase

## Paso 1 — Actualizar las reglas de Firestore (importante, hacé esto primero)

Ahora mismo tu base de datos está en "modo de prueba", que **caduca solo a los 30 días** y a partir de ahí bloquea todo. Para dejarla funcionando de forma permanente:

1. Andá a [Firebase Console](https://console.firebase.google.com) → tu proyecto → **Firestore Database** → pestaña **Reglas**.
2. Borrá lo que hay y pegá el contenido de `firestore.rules` (está en esta misma carpeta).
3. Clic en **Publicar**.

Esto deja las colecciones `subjects` y `tasks` abiertas a quien tenga el link de la app — sin login, tal como lo querían desde el inicio. Ojo con eso: cualquiera que tenga el código de la app (que va a quedar público en GitHub) técnicamente podría leer o escribir esos datos. Para una lista de tareas de dos personas es un riesgo bajo, pero es bueno que lo sepan.

## Paso 2 — Subir a GitHub Pages

1. Creá un repositorio nuevo en GitHub (público, para que Pages sea gratis).
2. Subí estos archivos (`index.html`, `style.css`, `app.js`, `firebase-config.js`) a la raíz del repo — podés arrastrarlos desde la web de GitHub con "Add file → Upload files", o con git si ya lo usás.
3. Andá a **Settings → Pages** en el repositorio.
4. En "Source" elegí **Deploy from a branch**, branch `main`, carpeta `/ (root)` → **Save**.
5. Esperá 1-2 minutos y GitHub te va a dar un link tipo `https://tu-usuario.github.io/tu-repo/`.

Ese link es el que comparten los dos — cada uno lo abre desde su navegador y ven las mismas tareas en tiempo real (Firestore sincroniza solo, sin recargar la página).

## Notas

- El nombre que cada quien pone al entrar ("¿Cómo te llamás?") se guarda solo en su propio navegador (localStorage), no en Firebase — así cada quien no tiene que reescribirlo, pero tampoco se mezcla con el de la otra persona.
- Los datos de tareas y materias sí son compartidos entre los dos, en tiempo real.
- El plan gratuito de Firebase (Spark) alcanza de sobra para este uso — no debería costar nada.
