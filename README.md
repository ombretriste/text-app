# TextCTRL

Versión 0.3.1 · by OmT Finance

App web (PWA) con un editor de texto sencillo. Mismo estilo que las demás apps de OmT Finance, en tinta
añil. Los documentos se guardan en el dispositivo (IndexedDB) y, si conectas una cuenta de CloudCTRL (⋯ → Nube), también en la nube, cifrados. `cloud.js` es una copia del de cloudctrl.

## Funciones

- Estilos (Normal, Título 1–3), letra, tamaño, negrita, cursiva, subrayado, tachado, color y resaltado.
- Alineación, listas, citas, enlaces, imágenes, tablas y líneas separadoras.
- Deshacer y rehacer, buscar y reemplazar, recuento de palabras, autoguardado e impresión.
- **Guardar como:** PDF, Word (.docx), HTML, Markdown y texto, en este dispositivo o como archivo en la nube (CloudCTRL). Cada documento tiene un archivo por formato: exportar otra vez lo actualiza.
- **Abrir:** Word (.docx), texto, Markdown y HTML.

## Cómo funciona

- `app.js`: interfaz y editor (`contenteditable` + `execCommand`, que da deshacer sin más código).
- `formats.js`: todo lo que entra pasa por `sanitize`; cada formato de salida parte de `parseBlocks`.
  El zip del .docx y el PDF están escritos a mano, sin librerías.
- Sin `api/`: solo necesita hosting estático y activar Web Analytics en Vercel.

## Seguridad

- **En el dispositivo**: los documentos están en IndexedDB del navegador, aislados de otras webs y apps y protegidos por el bloqueo del móvil.
- **En la nube** (opcional, CloudCTRL): documentos y archivos exportados se cifran en el dispositivo (AES-GCM, clave PBKDF2 de 310 000 iteraciones a partir de la contraseña); el servidor solo ve bloques ilegibles, ni siquiera los nombres.
- **Lo que entra** (pegar, abrir archivos) pasa por `sanitize`: solo etiquetas y estilos de texto, sin scripts, enlaces `javascript:` ni imágenes remotas.
- **Política de seguridad (CSP) y cabeceras** en `vercel.json`, como en UnderCTRL: solo se ejecuta código de la propia app (nada en línea: lo que iba en `index.html` está en `boot.js`), solo se conecta a su propio servidor y a la API de CloudCTRL, no se puede incrustar en otra web (`frame-ancestors 'none'`), `nosniff` y `no-referrer`.

## Límites conocidos

- El PDF usa las fuentes estándar (Helvetica, Times, Courier): los caracteres fuera de WinAnsi, como
  emojis o griego, salen como «?» y la app lo avisa.
- Al abrir un .docx se pierde lo que no tiene equivalente en el editor (encabezados, notas al pie,
  comentarios, colores heredados de estilos).
- Markdown no incluye las imágenes.
- Los documentos no se sincronizan entre dispositivos.
