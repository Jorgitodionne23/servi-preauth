# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 01-landing.spec.js >> 1.3 No email/password option in auth modal
- Location: tests/01-landing.spec.js:27:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('#auth-identifier')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('#auth-identifier')

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - heading "Ingresa a SERVI" [level=2] [ref=e6]
      - button [ref=e7] [cursor=pointer]:
        - img [ref=e8]
    - button "Continuar con Google" [ref=e10] [cursor=pointer]:
      - img [ref=e11]
      - text: Continuar con Google
    - generic [ref=e18]: o
    - generic [ref=e21]:
      - textbox "Nombre completo" [ref=e22]
      - textbox "+52 55 1234 5678" [ref=e23]
      - button "Enviar código" [ref=e24] [cursor=pointer]
  - navigation [ref=e25]:
    - generic [ref=e26]:
      - link "SERVI ." [ref=e27] [cursor=pointer]:
        - /url: /index.html
        - text: SERVI
        - generic [ref=e28]: .
      - generic [ref=e29]:
        - generic [ref=e30] [cursor=pointer]: Servicios
        - generic [ref=e31] [cursor=pointer]: Cómo funciona
        - generic [ref=e32] [cursor=pointer]: Testimonios
        - link "Help Center" [ref=e33] [cursor=pointer]:
          - /url: /helpcenter.html
        - link "Partners" [ref=e34] [cursor=pointer]:
          - /url: /partners.html
      - generic [ref=e35]:
        - generic [ref=e36]:
          - button "ES" [ref=e37] [cursor=pointer]
          - button "EN" [ref=e38] [cursor=pointer]
        - generic [ref=e39]:
          - button "Iniciar sesión" [ref=e40] [cursor=pointer]
          - button "Crear cuenta" [active] [ref=e41] [cursor=pointer]
  - generic [ref=e44]:
    - heading "Servicios a domicilio. Sin complicaciones." [level=1] [ref=e45]:
      - text: Servicios a domicilio.
      - text: Sin complicaciones.
    - paragraph [ref=e46]: Desde limpieza hasta reparaciones — encuentra al especialista ideal en minutos, no en días.
    - button "Solicitar servicio" [ref=e48] [cursor=pointer]:
      - generic [ref=e49]: Solicitar servicio
      - img [ref=e50]
  - generic [ref=e53]:
    - heading "Explora nuestros servicios" [level=2] [ref=e54]
    - generic [ref=e55]:
      - generic [ref=e56] [cursor=pointer]:
        - img [ref=e58]
        - generic [ref=e62]:
          - text: Limpieza
          - img [ref=e64]
        - generic [ref=e66]: Hogar, oficina, jardín y más
      - generic [ref=e67] [cursor=pointer]:
        - img [ref=e69]
        - generic [ref=e71]:
          - text: Reparación y Mantenimiento
          - img [ref=e73]
        - generic [ref=e75]: Plomería, electricidad, técnicos
      - generic [ref=e76] [cursor=pointer]:
        - img [ref=e78]
        - generic [ref=e80]:
          - text: Bienestar y Cuidado Personal
          - img [ref=e82]
        - generic [ref=e84]: Cuidado personal a domicilio
      - generic [ref=e85] [cursor=pointer]:
        - img [ref=e87]
        - generic [ref=e90]:
          - text: Mantenimiento
          - img [ref=e92]
        - generic [ref=e94]: Preventivo e instalaciones
      - generic [ref=e95] [cursor=pointer]:
        - img [ref=e97]
        - generic [ref=e100]:
          - text: Abastecimiento y Compras
          - img [ref=e102]
        - generic [ref=e104]: Compras, entregas y mandados
      - generic [ref=e105] [cursor=pointer]:
        - img [ref=e107]
        - generic [ref=e110]:
          - text: Personalizado
          - img [ref=e112]
        - generic [ref=e114]: Descríbelo y te lo buscamos
  - generic [ref=e117]:
    - heading "Así de fácil" [level=2] [ref=e118]
    - generic [ref=e119]:
      - generic [ref=e120]:
        - generic [ref=e121]: "1"
        - generic [ref=e122]:
          - generic [ref=e123]: Elige tu servicio
          - generic [ref=e124]: Selecciona la categoría y describe lo que necesitas.
      - generic [ref=e125]:
        - generic [ref=e126]: "2"
        - generic [ref=e127]:
          - generic [ref=e128]: SERVI Match
          - generic [ref=e129]: Te asignamos al especialista verificado más cercano.
      - generic [ref=e130]:
        - generic [ref=e131]: "3"
        - generic [ref=e132]:
          - generic [ref=e133]: Listo
          - generic [ref=e134]: Tu especialista llega. Nosotros nos encargamos del resto.
  - generic [ref=e138]:
    - generic [ref=e139]:
      - heading "¿Por qué SERVI?" [level=2] [ref=e140]
      - paragraph [ref=e141]: Hoy puedes pedir comida o un taxi en segundos, pero encontrar un plomero o un electricista sigue siendo lento, informal y desorganizado.
      - paragraph [ref=e142]: SERVI gestiona todo el proceso por ti.
    - generic [ref=e143]:
      - generic [ref=e144]:
        - generic [ref=e145]: 500+
        - generic [ref=e146]: Servicios realizados
      - generic [ref=e147]:
        - generic [ref=e148]: 98%
        - generic [ref=e149]: Satisfacción
      - generic [ref=e150]:
        - generic [ref=e151]: 50+
        - generic [ref=e152]: Especialistas verificados
      - generic [ref=e153]:
        - generic [ref=e154]: 24h
        - generic [ref=e155]: Tiempo promedio de respuesta
  - generic [ref=e158]:
    - generic [ref=e159]: Muy pronto
    - heading "La app de SERVI" [level=2] [ref=e160]
    - paragraph [ref=e161]: Solicita servicios, da seguimiento y paga — todo desde tu celular.
    - generic [ref=e164]:
      - generic [ref=e165]: SERVI.
      - generic [ref=e166]:
        - generic [ref=e169]: Limpieza
        - generic [ref=e172]: Reparación y Mantenimiento
        - generic [ref=e175]: Bienestar y Cuidado Personal
        - generic [ref=e178]: Mantenimiento
        - generic [ref=e181]: Abastecimiento y Compras
        - generic [ref=e184]: Personalizado
  - generic [ref=e187]:
    - heading "Nuestros clientes" [level=2] [ref=e188]
    - generic [ref=e189]:
      - generic [ref=e190]:
        - generic [ref=e191]: “
        - paragraph [ref=e192]: Un proceso bastante sencillo. No me tuve que preocupar por investigar ni en contactar al especialista. Ya no tengo que estar preguntando en grupos por especialistas.
        - generic [ref=e193]:
          - generic [ref=e194]: D
          - generic [ref=e195]: Diego Flores
      - generic [ref=e196]:
        - generic [ref=e197]: “
        - paragraph [ref=e198]: Mi calentador dejó de funcionar y no sabía a quién acudir. A través de SERVI me conectaron con el especialista indicado, detectó que faltaba una pieza y ellos se encargaron de conseguirla, instalarla y dejar todo funcionando. Muy práctico!
        - generic [ref=e199]:
          - generic [ref=e200]: P
          - generic [ref=e201]: Patricia Espinoza
      - generic [ref=e202]:
        - generic [ref=e203]: “
        - paragraph [ref=e204]: ¡Una alternativa más segura! Me ayudaron sustituir a mi jardinero, con quien estaba teniendo problemas. ¡Estoy más tranquila sabiendo que tengo el respaldo de un intermediario por cualquier cosa!
        - generic [ref=e205]:
          - generic [ref=e206]: V
          - generic [ref=e207]: Valeria Sanchez
  - generic [ref=e210]:
    - heading "¿Eres proveedor de servicios?" [level=2] [ref=e211]
    - paragraph [ref=e212]: Ofrece tus servicios con SERVI y haz crecer tu clientela de manera gratuita.
    - generic [ref=e213]:
      - link "Guía para ganar con SERVI" [ref=e214] [cursor=pointer]:
        - /url: /partners.html
      - link "Aplicar como Partner" [ref=e215] [cursor=pointer]:
        - /url: /partners.html#how
  - generic [ref=e217]:
    - heading "Contacto" [level=2] [ref=e218]
    - generic [ref=e219]:
      - generic [ref=e220]:
        - img [ref=e221]
        - generic [ref=e224]: Santa Fe, Cuajimalpa de Morelos, Ciudad de México, CDMX.
      - generic [ref=e225]:
        - img [ref=e226]
        - generic [ref=e229]: serv.clientserv@gmail.com
      - link "WhatsApp" [ref=e230] [cursor=pointer]:
        - /url: https://wa.me/525525112588
        - img [ref=e231]
        - generic [ref=e233]: WhatsApp
  - button "Solicita tu servicio" [ref=e236] [cursor=pointer]:
    - generic [ref=e237]: Solicita tu servicio
    - img [ref=e238]
  - contentinfo [ref=e241]:
    - generic [ref=e242]:
      - generic [ref=e243]:
        - generic [ref=e244]:
          - generic [ref=e245] [cursor=pointer]:
            - text: SERVI
            - generic [ref=e246]: .
          - generic [ref=e247]: Santa Fe, Cuajimalpa de Morelos, Ciudad de México, CDMX.
        - generic [ref=e248]:
          - generic [ref=e249]: SERVI
          - link "Solicita" [ref=e250] [cursor=pointer]:
            - /url: /index.html#services
          - link "Qué ofrecemos" [ref=e251] [cursor=pointer]:
            - /url: /index.html#services
          - link "Cómo funciona" [ref=e252] [cursor=pointer]:
            - /url: /index.html#how
          - link "App" [ref=e253] [cursor=pointer]:
            - /url: /index.html#app
          - link "Testimonios" [ref=e254] [cursor=pointer]:
            - /url: /index.html#testimonials
        - generic [ref=e255]:
          - generic [ref=e256]: Partners
          - link "Quiero ser partner" [ref=e257] [cursor=pointer]:
            - /url: /partners.html
          - link "Qué es ser Partner" [ref=e258] [cursor=pointer]:
            - /url: /partners.html#what
          - link "Cómo ser Partner" [ref=e259] [cursor=pointer]:
            - /url: /partners.html#how
          - link "Handbook" [ref=e260] [cursor=pointer]:
            - /url: /handbook.html
        - generic [ref=e261]:
          - generic [ref=e262]: Ayuda
          - link "Reportar/sugerencia" [ref=e263] [cursor=pointer]:
            - /url: /helpcenter.html
          - link "Quiénes Somos" [ref=e264] [cursor=pointer]:
            - /url: /helpcenter/quienes-somos.html
          - link "Contáctanos" [ref=e265] [cursor=pointer]:
            - /url: /helpcenter/contactanos.html
        - generic [ref=e266]:
          - generic [ref=e267]: Legal
          - link "Términos" [ref=e268] [cursor=pointer]:
            - /url: /legal.html#terms
          - link "Privacidad" [ref=e269] [cursor=pointer]:
            - /url: /legal.html#privacy
          - link "Política de Cancelación" [ref=e270] [cursor=pointer]:
            - /url: /legal.html#cancellation
          - link "Aviso Legal" [ref=e271] [cursor=pointer]:
            - /url: /legal.html#legal-notice
      - generic [ref=e273]: © 2026 SERVI. Todos los derechos reservados.
```

# Test source

```ts
  1  | // ─── Test Suite 1: Landing Page ───────────────────────────────────────────────
  2  | import { test, expect } from '@playwright/test';
  3  | import { clearSession } from './helpers.js';
  4  | 
  5  | test.beforeEach(async ({ page }) => {
  6  |   await clearSession(page);
  7  | });
  8  | 
  9  | test('1.1 Landing page loads with hero CTA', async ({ page }) => {
  10 |   await page.goto('/');
  11 |   // Navbar
  12 |   await expect(page.locator('#site-navbar')).toBeVisible();
  13 |   await expect(page.locator('#site-navbar .logo')).toContainText('SERVI');
  14 |   // Hero CTA button
  15 |   const cta = page.locator('.btn-primary--lg').first();
  16 |   await expect(cta).toBeVisible();
  17 | });
  18 | 
  19 | test('1.2 Service category cards are visible', async ({ page }) => {
  20 |   await page.goto('/');
  21 |   // Wait for categories section
  22 |   await page.waitForSelector('#services', { timeout: 10000 });
  23 |   const cards = page.locator('.card--clickable');
  24 |   await expect(cards).toHaveCount(6);
  25 | });
  26 | 
  27 | test('1.3 No email/password option in auth modal', async ({ page }) => {
  28 |   await page.goto('/');
  29 |   await page.locator('button', { hasText: /Crear cuenta|Sign up/i }).first().click();
  30 |   await page.waitForSelector('#auth-modal-global .modal-overlay', { timeout: 5000 });
  31 |   // Should have Google button
  32 |   await expect(page.locator('#google-auth-btn')).toBeVisible();
  33 |   // Should have single identifier input (USL flow)
> 34 |   await expect(page.locator('#auth-identifier')).toBeVisible();
     |                                                  ^ Error: expect(locator).toBeVisible() failed
  35 |   // Should have country code dropdown
  36 |   await expect(page.locator('#auth-country-code')).toBeVisible();
  37 |   // Should NOT have password input
  38 |   await expect(page.locator('input[type="password"]')).toHaveCount(0);
  39 | });
  40 | 
  41 | test('1.4 Auth modal closes on overlay click', async ({ page }) => {
  42 |   await page.goto('/');
  43 |   await page.locator('button', { hasText: /Iniciar sesión|Log in/i }).first().click();
  44 |   await page.waitForSelector('#auth-modal-global .modal-overlay', { timeout: 5000 });
  45 |   await expect(page.locator('#auth-identifier')).toBeVisible();
  46 |   // Click the overlay (outside the modal content)
  47 |   await page.locator('.modal-overlay').click({ position: { x: 5, y: 5 } });
  48 |   await expect(page.locator('#auth-identifier')).not.toBeVisible();
  49 | });
  50 | 
  51 | test('1.5 Language toggle switches ES→EN on landing', async ({ page }) => {
  52 |   await page.goto('/');
  53 |   // Default is Spanish
  54 |   const hero = page.locator('h1, .heading-xl').first();
  55 |   const spanishText = await hero.textContent();
  56 | 
  57 |   // Click EN
  58 |   await page.locator('.lang-btn', { hasText: 'EN' }).click();
  59 |   await page.waitForTimeout(500);
  60 |   const englishText = await hero.textContent();
  61 | 
  62 |   expect(spanishText).not.toBe(englishText);
  63 |   // Switch back
  64 |   await page.locator('.lang-btn', { hasText: 'ES' }).click();
  65 |   await page.waitForTimeout(500);
  66 |   const backToSpanish = await hero.textContent();
  67 |   expect(backToSpanish).toBe(spanishText);
  68 | });
  69 | 
  70 | test('1.6 Mobile hamburger menu opens and closes', async ({ page }) => {
  71 |   await page.setViewportSize({ width: 375, height: 812 });
  72 |   await page.goto('/');
  73 |   const hamburger = page.locator('.hamburger');
  74 |   await expect(hamburger).toBeVisible();
  75 |   await hamburger.click();
  76 |   await expect(page.locator('#mobile-menu')).toBeVisible();
  77 |   // Close button
  78 |   await page.locator('#mobile-menu button').first().click();
  79 |   await expect(page.locator('#mobile-menu')).not.toBeVisible();
  80 | });
  81 | 
  82 | test('1.7 Footer is present with key links', async ({ page }) => {
  83 |   await page.goto('/');
  84 |   await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  85 |   const footer = page.locator('#footer, footer, .footer');
  86 |   await expect(footer.first()).toBeVisible();
  87 | });
  88 | 
```