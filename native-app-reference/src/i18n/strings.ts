/**
 * SERVI bilingual strings (ES default, EN secondary).
 *
 * Mirrors the spirit of `frontend/shared/i18n.js` but scoped to the native
 * prototype's screens. Each entry is { es, en }. Spanish is the default
 * language across the app, matching the web product.
 */
export type Lang = 'es' | 'en';

export const strings = {
  // ── Common ───────────────────────────────────────────────
  'common.continue': { es: 'Continuar', en: 'Continue' },
  'common.back': { es: 'Volver', en: 'Back' },
  'common.next': { es: 'Siguiente', en: 'Next' },
  'common.cancel': { es: 'Cancelar', en: 'Cancel' },
  'common.confirm': { es: 'Confirmar', en: 'Confirm' },
  'common.close': { es: 'Cerrar', en: 'Close' },
  'common.save': { es: 'Guardar', en: 'Save' },
  'common.edit': { es: 'Editar', en: 'Edit' },
  'common.done': { es: 'Listo', en: 'Done' },
  'common.optional': { es: 'Opcional', en: 'Optional' },
  'common.required': { es: 'Requerido', en: 'Required' },
  'common.retry': { es: 'Reintentar', en: 'Try again' },
  'common.seeAll': { es: 'Ver todo', en: 'See all' },
  'common.search': { es: 'Buscar', en: 'Search' },
  'common.skip': { es: 'Omitir por ahora', en: 'Skip for now' },

  // ── Tabs ─────────────────────────────────────────────────
  'tab.home': { es: 'Inicio', en: 'Home' },
  'tab.browse': { es: 'Explorar', en: 'Browse' },
  'tab.orders': { es: 'Pedidos', en: 'Orders' },
  'tab.account': { es: 'Cuenta', en: 'Account' },

  // ── Home / Smart Request ─────────────────────────────────
  'home.greeting': { es: 'Hola', en: 'Hi' },
  'home.eyebrow': { es: 'SERVI Inteligente', en: 'SERVI Intelligence' },
  'home.title': { es: '¿Qué necesitas hoy?', en: 'What do you need today?' },
  'home.subtitle': {
    es: 'Descríbelo, muéstralo o dilo. Encontramos al especialista correcto.',
    en: 'Describe it, show it, or say it. We find the right specialist.',
  },
  'home.inputPlaceholder': {
    es: 'Ej. Se tapó el lavabo de la cocina…',
    en: 'E.g. My kitchen sink is clogged…',
  },
  'home.orRequestAnother': { es: 'O solicita de otra forma', en: 'Or request another way' },
  'home.mode.voice': { es: 'Nota de voz', en: 'Voice note' },
  'home.mode.voiceSub': { es: 'Dilo en voz alta', en: 'Say it out loud' },
  'home.mode.photo': { es: 'Agregar fotos', en: 'Add photos' },
  'home.mode.photoSub': { es: 'Toma o sube', en: 'Snap or upload' },
  'home.mode.video': { es: 'Graba un video', en: 'Record a video' },
  'home.mode.videoSub': { es: 'Muestra el problema', en: 'Show the problem' },
  'home.categoriesTitle': { es: 'Categorías', en: 'Categories' },
  'home.popularTitle': { es: 'Populares en tu zona', en: 'Popular near you' },
  'home.send': { es: 'Continuar', en: 'Continue' },

  // ── Browse ───────────────────────────────────────────────
  'browse.title': { es: 'Explorar servicios', en: 'Browse services' },
  'browse.searchPlaceholder': { es: 'Busca un servicio', en: 'Search a service' },
  'browse.allCategories': { es: 'Todas las categorías', en: 'All categories' },
  'browse.servicesCount': { es: 'servicios', en: 'services' },
  'browse.subcategories': { es: 'Subcategorías', en: 'Subcategories' },
  'browse.examples': { es: 'Ejemplos de servicios', en: 'Example services' },
  'browse.requestThis': { es: 'Solicitar esto', en: 'Request this' },
  'browse.noResults': { es: 'Sin resultados', en: 'No results' },
  'browse.noResultsSub': {
    es: 'No encontramos eso. Intenta describirlo en Inicio.',
    en: "We couldn't find that. Try describing it on Home.",
  },

  // ── Request builder ──────────────────────────────────────
  'req.compose.title': { es: 'Cuéntanos qué necesitas', en: 'Tell us what you need' },
  'req.mode.text': { es: 'Escribir', en: 'Type' },
  'req.mode.voice': { es: 'Voz', en: 'Voice' },
  'req.mode.photo': { es: 'Fotos', en: 'Photos' },
  'req.mode.video': { es: 'Video', en: 'Video' },
  'req.voice.hint': { es: 'Toca para grabar · hasta 60s', en: 'Tap to record · up to 60s' },
  'req.voice.recording': { es: 'Grabando…', en: 'Recording…' },
  'req.voice.use': { es: 'Usar esta grabación', en: 'Use this recording' },
  'req.voice.rerecord': { es: 'Volver a grabar', en: 'Re-record' },
  'req.voice.note': {
    es: 'SERVI transcribe y entiende tu nota.',
    en: 'SERVI will transcribe and understand your note.',
  },
  'req.photo.empty': {
    es: 'Toma o sube fotos del problema',
    en: 'Take or upload photos of the problem',
  },
  'req.photo.choose': { es: 'Elegir fotos', en: 'Choose photos' },
  'req.photo.sample': { es: 'Probar un ejemplo', en: 'Try a sample' },
  'req.photo.note': {
    es: 'SERVI lee tus fotos para entender el trabajo.',
    en: 'SERVI reads your photos to understand the job.',
  },
  'req.video.empty': { es: 'Graba o sube un video corto', en: 'Record or upload a short video' },
  'req.video.record': { es: 'Grabar ahora', en: 'Record now' },
  'req.video.upload': { es: 'Subir video', en: 'Upload video' },
  'req.video.note': {
    es: 'Nuestros especialistas revisan tu clip.',
    en: 'Our specialists review your clip.',
  },
  'req.thinking.text': { es: 'Leyendo tu solicitud…', en: 'Reading your request…' },
  'req.thinking.voice': { es: 'Escuchando…', en: 'Listening…' },
  'req.thinking.photo': { es: 'Viendo tus fotos…', en: 'Looking at your photos…' },
  'req.understand.eyebrow': { es: 'Esto entendí', en: "Here's what I understood" },
  'req.understand.match': { es: 'coincidencia', en: 'match' },
  'req.understand.change': { es: '¿No es esto? Cambiar servicio', en: 'Not quite? Change service' },
  'req.videoReceived.eyebrow': { es: 'Solicitud capturada', en: 'Request captured' },
  'req.videoReceived.title': { es: 'Video recibido', en: 'Video received' },
  'req.videoReceived.body': {
    es: 'Nuestros especialistas revisarán tu clip y confirmarán los detalles por WhatsApp.',
    en: 'Our specialists will review your clip and confirm details on WhatsApp.',
  },
  'req.followups.title': { es: 'Unos detalles rápidos', en: 'A few quick details' },
  'req.followups.sub': {
    es: 'Opcional — ayuda a que tu especialista llegue listo.',
    en: 'Optional — helps your specialist arrive ready.',
  },
  'req.when.title': { es: '¿Cuándo y dónde?', en: 'When & where?' },
  'req.when.asap': { es: 'Lo antes posible', en: 'As soon as possible' },
  'req.when.schedule': { es: 'Programar para después', en: 'Schedule for later' },
  'req.when.date': { es: 'Fecha', en: 'Date' },
  'req.when.time': { es: 'Hora', en: 'Time' },
  'req.address.label': { es: 'Dirección del servicio', en: 'Service address' },
  'req.address.choose': { es: 'Elegir dirección', en: 'Choose address' },
  'req.address.add': { es: 'Agregar nueva dirección', en: 'Add a new address' },
  'req.address.useCurrent': { es: 'Usar ubicación actual', en: 'Use current location' },
  'req.address.locating': { es: 'Ubicando…', en: 'Locating…' },
  'req.review.title': { es: 'Revisa tu solicitud', en: 'Review your request' },
  'req.review.summary': { es: 'Tu solicitud', en: 'Your request' },
  'req.review.service': { es: 'Servicio', en: 'Service' },
  'req.review.category': { es: 'Categoría', en: 'Category' },
  'req.review.details': { es: 'Detalles', en: 'Details' },
  'req.review.when': { es: 'Cuándo', en: 'When' },
  'req.review.where': { es: 'Dónde', en: 'Where' },
  'req.review.next.title': { es: 'Qué sigue', en: 'What happens next' },
  'req.review.next.eta': { es: 'Normalmente ~15 min', en: 'Usually within ~15 min' },
  'req.review.next.step1': { es: 'Asignamos a tu especialista', en: 'We match your specialist' },
  'req.review.next.step2': { es: 'Confirmamos el precio', en: 'We confirm the price' },
  'req.review.next.step3': { es: 'Te escribimos por WhatsApp', en: 'We reach out on WhatsApp' },
  'req.review.send': { es: 'Enviar solicitud', en: 'Send request' },
  'req.review.fineprint': {
    es: 'No se te cobra ahora. Confirmamos el precio antes de cualquier cosa.',
    en: "You won't be charged now. We confirm the price before anything happens.",
  },
  'req.submitted.title': { es: 'Solicitud enviada', en: 'Request sent' },
  'req.submitted.body': {
    es: 'Te escribiremos por WhatsApp para confirmar a tu especialista y el precio.',
    en: "We'll text you on WhatsApp to confirm your specialist and the price.",
  },
  'req.submitted.code': { es: 'Código de solicitud', en: 'Request code' },
  'req.submitted.openChat': { es: 'Abrir chat de WhatsApp', en: 'Open WhatsApp chat' },
  'req.submitted.trackOrder': { es: 'Ver estado del pedido', en: 'Track this order' },
  'req.submitted.newRequest': { es: 'Nueva solicitud', en: 'New request' },

  // ── Auth ─────────────────────────────────────────────────
  'auth.signInTitle': { es: 'Ingresa a SERVI', en: 'Sign in to SERVI' },
  'auth.signInSub': {
    es: 'Escribe tu número o correo para continuar',
    en: 'Enter your phone or email to continue',
  },
  'auth.google': { es: 'Continuar con Google', en: 'Continue with Google' },
  'auth.or': { es: 'o', en: 'or' },
  'auth.phoneOrEmail': { es: 'Teléfono o correo', en: 'Phone or email' },
  'auth.phoneHint': {
    es: 'Si usas correo, la bandera desaparece automáticamente',
    en: 'If you use email, the flag disappears automatically',
  },
  'auth.otp.phoneTitle': { es: 'Verificar teléfono', en: 'Verify phone' },
  'auth.otp.emailTitle': { es: 'Verificar correo', en: 'Verify email' },
  'auth.otp.phoneSub': { es: 'Enviamos un código SMS a', en: 'We sent an SMS code to' },
  'auth.otp.emailSub': {
    es: 'Enviamos un código de 6 dígitos a',
    en: 'We sent a 6-digit code to',
  },
  'auth.otp.verify': { es: 'Verificar', en: 'Verify' },
  'auth.otp.resend': { es: 'Reenviar código', en: 'Resend code' },
  'auth.emailSoon': {
    es: 'Por ahora inicia sesión con tu teléfono.',
    en: 'For now, sign in with your phone.',
  },
  'auth.error.sms': {
    es: 'No pudimos enviar el código. Revisa el número e intenta de nuevo.',
    en: "We couldn't send the code. Check the number and try again.",
  },
  'auth.error.code': { es: 'Código incorrecto. Intenta de nuevo.', en: 'Wrong code. Try again.' },
  'auth.error.unavailable': {
    es: 'Inicia sesión desde la app instalada — no disponible en esta vista previa.',
    en: 'Sign-in requires the installed app — not available in this preview.',
  },
  'auth.email.later': {
    es: 'Podrás agregar y verificar tu correo después desde tu cuenta.',
    en: 'You can add and verify your email later from your account.',
  },
  'req.review.signInToSend': { es: 'Inicia sesión para enviar', en: 'Sign in to send' },
  'req.review.sendError': {
    es: 'No se pudo enviar. Revisa tu conexión e intenta de nuevo.',
    en: "Couldn't send. Check your connection and try again.",
  },
  'req.uploading': { es: 'Subiendo…', en: 'Uploading…' },
  'order.rate.title': { es: '¿Cómo estuvo el servicio?', en: 'How was the service?' },
  'order.rate.thanks': { es: '¡Gracias por tu calificación!', en: 'Thanks for your rating!' },
  'auth.otp.noPhone': { es: '¿No tienes acceso a tu teléfono?', en: "Can't access your phone?" },
  'auth.name.verified': { es: 'Número verificado', en: 'Number verified' },
  'auth.name.title': { es: '¿Cuál es tu nombre?', en: "What's your name?" },
  'auth.name.sub': {
    es: 'Lo usamos para personalizar tus solicitudes',
    en: 'We use it to personalize your requests',
  },
  'auth.name.first': { es: 'Nombre', en: 'First name' },
  'auth.name.last': { es: 'Apellido', en: 'Last name' },
  'auth.email.title': { es: 'Agrega tu correo', en: 'Add your email' },
  'auth.email.sub': {
    es: 'Recibe confirmaciones y recupera tu cuenta fácil',
    en: 'Get confirmations and easy account recovery',
  },
  'auth.email.verify': { es: 'Verificar correo', en: 'Verify email' },
  'auth.email.skipNote': {
    es: 'Necesitarás un correo verificado para confirmar futuras solicitudes',
    en: "You'll need a verified email to confirm future requests",
  },
  'auth.gate.title': { es: 'Completa tu perfil para continuar', en: 'Complete your profile to continue' },
  'auth.gate.body': {
    es: 'Necesitas un correo verificado para confirmar solicitudes. Solo toma un momento.',
    en: 'You need a verified email to confirm requests. It only takes a moment.',
  },
  'auth.gate.sendCode': { es: 'Enviar código', en: 'Send code' },
  'auth.success': { es: 'Sesión iniciada', en: 'Signed in' },

  // ── Orders / lifecycle ───────────────────────────────────
  'orders.title': { es: 'Mis pedidos', en: 'My orders' },
  'orders.active': { es: 'Activos', en: 'Active' },
  'orders.past': { es: 'Anteriores', en: 'Past' },
  'orders.empty': { es: 'Aún no tienes pedidos', en: 'No orders yet' },
  'orders.emptySub': {
    es: 'Cuando solicites un servicio aparecerá aquí.',
    en: 'When you request a service it shows up here.',
  },
  'orders.emptyCta': { es: 'Solicitar un servicio', en: 'Request a service' },
  'order.timeline': { es: 'Estado del pedido', en: 'Order status' },
  'order.specialist': { es: 'Tu especialista', en: 'Your specialist' },
  'order.specialistPending': { es: 'Asignando especialista…', en: 'Matching specialist…' },
  'order.assigningBody': {
    es: 'SERVI está asignando a un especialista verificado para tu servicio.',
    en: 'SERVI is assigning a verified specialist for your service.',
  },
  'order.payNow': { es: 'Autorizar tarjeta', en: 'Authorize card' },
  'order.viewPayment': { es: 'Ver detalle de pago', en: 'View payment detail' },
  'order.contactSupport': { es: 'Contactar a SERVI', en: 'Contact SERVI' },
  'order.rebook': { es: 'Volver a solicitar', en: 'Request again' },

  // Status labels (customer-facing)
  'status.pending': { es: 'Pago pendiente', en: 'Payment pending' },
  'status.scheduled': { es: 'Programado', en: 'Scheduled' },
  'status.confirmed': { es: 'Confirmado · tarjeta retenida', en: 'Confirmed · card held' },
  'status.assigned': { es: 'Especialista asignado', en: 'Specialist assigned' },
  'status.inProgress': { es: 'En servicio', en: 'In service' },
  'status.completed': { es: 'Servicio completado', en: 'Service completed' },
  'status.captured': { es: 'Pagado', en: 'Paid' },
  'status.refunded': { es: 'Reembolsado', en: 'Refunded' },
  'status.cancelled': { es: 'Cancelado', en: 'Cancelled' },
  'status.blocked': { es: 'Requiere tarjeta guardada', en: 'Saved card required' },

  // ── Payment / pre-auth reference ─────────────────────────
  'pay.refDisclaimer': {
    es: 'Prototipo de referencia — sin pagos reales',
    en: 'Reference prototype — no real payments',
  },
  'pay.title': { es: 'Cómo funciona el pago', en: 'How payment works' },
  'pay.hold.title': { es: 'Retención, no un cargo', en: 'A hold, not a charge' },
  'pay.hold.body': {
    es: 'Pre-autorizamos tu tarjeta (una retención). Solo cobramos después de completar el servicio.',
    en: 'We pre-authorize your card (a hold). We only charge after the service is completed.',
  },
  'pay.link.title': { es: 'Enlace de pago', en: 'Payment link' },
  'pay.link.body': {
    es: 'La primera vez recibes un enlace por WhatsApp para autorizar tu tarjeta.',
    en: 'The first time, you get a link on WhatsApp to authorize your card.',
  },
  'pay.saved.title': { es: 'Tarjeta guardada + consentimiento', en: 'Saved card + consent' },
  'pay.saved.body': {
    es: 'Si guardas tu tarjeta con consentimiento, las próximas reservas se autorizan automáticamente.',
    en: 'If you save your card with consent, future bookings authorize automatically.',
  },
  'pay.auto.title': { es: 'Auto-pre-autorización ~24h antes', en: 'Auto pre-auth ~24h before' },
  'pay.auto.body': {
    es: 'La retención se coloca alrededor de 24 horas antes del servicio. No haces nada.',
    en: 'The hold is placed about 24 hours before the service. You do nothing.',
  },
  'pay.fiveday.title': { es: 'Reservas con 5+ días', en: 'Bookings 5+ days out' },
  'pay.fiveday.body': {
    es: 'Para reservar con 5 días o más de anticipación se requiere una tarjeta guardada.',
    en: 'Booking 5 or more days ahead requires a saved card.',
  },
  'pay.visit.title': { es: 'Visitas de cotización', en: 'Quote visits' },
  'pay.visit.body': {
    es: 'Una visita para cotizar siempre requiere una tarjeta guardada.',
    en: 'A quote visit always requires a saved card.',
  },
  'pay.method': { es: 'Método de pago', en: 'Payment method' },
  'pay.savedCard': { es: 'Tarjeta guardada', en: 'Saved card' },
  'pay.noCard': { es: 'Sin tarjeta guardada', en: 'No saved card' },
  'pay.addCard': { es: 'Guardar una tarjeta', en: 'Save a card' },
  'pay.consentLabel': {
    es: 'Autorizo a SERVI a retener mi tarjeta para confirmar el servicio',
    en: 'I authorize SERVI to hold my card to confirm the service',
  },

  // ── Price breakdown (mirrors frontend/success.html) ──────
  'price.service': { es: 'Precio del servicio', en: 'Service price' },
  'price.processing': { es: 'Comisión por procesamiento', en: 'Processing fee' },
  'price.vatIncluded': { es: '*IVA incluido', en: '*VAT included' },
  'price.total': { es: 'Total', en: 'Total' },
  'price.pending': { es: 'Precio por confirmar', en: 'Price to be confirmed' },
  'price.pendingBody': {
    es: 'SERVI confirma el precio con tu especialista antes de cualquier cargo o retención.',
    en: 'SERVI confirms the price with your specialist before any hold or charge.',
  },

  // ── Specialist card ──────────────────────────────────────
  'spec.trusted': { es: 'De confianza', en: 'Trusted' },
  'spec.verified': { es: 'Verificado por SERVI', en: 'SERVI-verified' },
  'spec.new': { es: 'Nuevo en SERVI', en: 'New on SERVI' },
  'spec.maskedNote': {
    es: 'Por privacidad mostramos solo el nombre y la inicial. Todo el contacto pasa por SERVI.',
    en: 'For privacy we show first name and initial only. All contact goes through SERVI.',
  },

  // ── On-site milestones (customer view of the specialist's check-ins) ──
  'phase.title': { es: 'En sitio', en: 'On site' },
  'phase.en_route': { es: 'En camino', en: 'On the way' },
  'phase.arrived': { es: 'Llegó', en: 'Arrived' },
  'phase.started': { es: 'Trabajo iniciado', en: 'Work started' },
  'phase.completed': { es: 'Trabajo terminado', en: 'Work completed' },
  'order.location': { es: 'Ubicación compartida', en: 'Location shared' },
  'order.locationBody': {
    es: 'Tu especialista compartió su ubicación a las {time}. SERVI no rastrea de forma continua.',
    en: 'Your specialist shared their location at {time}. SERVI does not track continuously.',
  },
  'order.request': { es: 'Tu solicitud', en: 'Your request' },
  'dock.active': { es: 'Pedido activo', en: 'Active order' },

  // ── Tip (optional, post-service; 100% to the specialist) ──
  'tip.title': { es: 'Propina', en: 'Tip' },
  'tip.subtitle': { es: '¿Quieres dar una propina a {name}?', en: 'Want to tip {name}?' },
  'tip.custom': { es: 'Otra cantidad', en: 'Other amount' },
  'tip.give': { es: 'Dar', en: 'Give' },
  'tip.hundredPct': {
    es: 'El 100% es para tu especialista. La propina se suma, no se descuenta.',
    en: '100% goes to your specialist. A tip is added on top, never deducted.',
  },
  'tip.disclaimer': { es: 'Prototipo — sin cargo real.', en: 'Prototype — no real charge.' },
  'tip.thanksTitle': { es: '¡Gracias!', en: 'Thank you!' },
  'tip.thanksBody': {
    es: 'Diste una propina de {amount}. El 100% es para {name}.',
    en: 'You tipped {amount}. 100% goes to {name}.',
  },

  // ── Account ──────────────────────────────────────────────
  'account.title': { es: 'Cuenta', en: 'Account' },
  'account.guest': { es: 'Invitado', en: 'Guest' },
  'account.signInPrompt': {
    es: 'Inicia sesión para solicitar servicios y ver tus pedidos',
    en: 'Sign in to request services and see your orders',
  },
  'account.signIn': { es: 'Iniciar sesión', en: 'Sign in' },
  'account.profile': { es: 'Información personal', en: 'Personal info' },
  'account.addresses': { es: 'Direcciones guardadas', en: 'Saved addresses' },
  'account.payment': { es: 'Método de pago', en: 'Payment method' },
  'account.history': { es: 'Historial de pedidos', en: 'Order history' },
  'account.language': { es: 'Idioma', en: 'Language' },
  'account.help': { es: 'Ayuda y contacto', en: 'Help & contact' },
  'account.partner': { es: 'Conviértete en Partner', en: 'Become a Partner' },
  'account.partnerSub': {
    es: 'Ofrece tus servicios en SERVI',
    en: 'Offer your services on SERVI',
  },
  'account.logout': { es: 'Cerrar sesión', en: 'Log out' },
  'account.default': { es: 'Predeterminada', en: 'Default' },
  'account.setDefault': { es: 'Hacer predeterminada', en: 'Set as default' },
  'account.on': { es: 'Activo', en: 'On' },
  'account.off': { es: 'Inactivo', en: 'Off' },
  'account.phoneVerified': { es: 'Teléfono verificado', en: 'Phone verified' },
  'account.emailVerified': { es: 'Correo verificado', en: 'Email verified' },
  'account.cardExp': { es: 'Vence', en: 'Exp' },
  'account.consentOnFile': { es: 'Con consentimiento', en: 'Consent on file' },
  'account.savedCount': { es: '{n} guardadas', en: '{n} saved' },
  'account.savedCount.one': { es: '1 guardada', en: '1 saved' },
  'account.ordersCount': { es: '{n} pedidos', en: '{n} orders' },
  'account.ordersCount.one': { es: '1 pedido', en: '1 order' },
  'account.footer': { es: 'Prototipo de referencia nativa', en: 'Native design reference' },
  'account.demo.title': { es: 'Estados de demostración', en: 'Demo states' },
  'account.demo.offline': { es: 'Banner sin conexión', en: 'Offline banner' },
  'account.demo.offlineSub': { es: 'Se muestra en todas las pantallas', en: 'Shows across all screens' },
  'account.demo.error': { es: 'Forzar error de solicitud', en: 'Force request error' },
  'account.demo.errorSub': { es: 'Aparece al analizar una solicitud', en: 'Appears when parsing a request' },
  'account.demo.advance': { es: 'Avanzar fase (SV-204701)', en: 'Advance phase (SV-204701)' },
  'account.demo.advanceSub': { es: 'Simula el check-in del especialista', en: 'Simulates the specialist check-in' },
  'address.field.label': { es: 'Etiqueta', en: 'Label' },
  'address.field.street': { es: 'Calle y número', en: 'Street & number' },
  'address.field.colonia': { es: 'Colonia', en: 'Neighborhood' },
  'review.preview': { es: 'Previsualizar:', en: 'Preview:' },
  'review.visitLabel': { es: 'Visita de cotización', en: 'Quote visit' },
  'req.submitted.coordinator': {
    es: 'Un coordinador de SERVI revisa tu solicitud y asigna a un especialista verificado.',
    en: 'A SERVI coordinator reviews your request and assigns a verified specialist.',
  },

  // ── Help ─────────────────────────────────────────────────
  'help.title': { es: 'Ayuda y contacto', en: 'Help & contact' },
  'help.sub': {
    es: 'Estamos en Santa Fe, Cuajimalpa, CDMX. Escríbenos y te respondemos rápido.',
    en: "We're in Santa Fe, Cuajimalpa, CDMX. Write to us and we'll reply fast.",
  },
  'help.email': { es: 'Enviar un correo', en: 'Send an email' },
  'help.faqTitle': { es: 'Preguntas frecuentes', en: 'Frequent questions' },

  // ── Partner ──────────────────────────────────────────────
  'partner.title': { es: 'Conviértete en SERVI Partner', en: 'Become a SERVI Partner' },
  'partner.sub': {
    es: 'Aplica gratis y ofrece tus servicios a clientes verificados en tu zona.',
    en: 'Apply for free and offer your services to verified clients in your area.',
  },
  'partner.cta': { es: 'Empezar solicitud', en: 'Start application' },
  'partner.note': {
    es: 'Esta es la app de cliente. El registro completo de Partner vive en la web por ahora.',
    en: 'This is the customer app. Full Partner onboarding lives on the web for now.',
  },

  // ── States ───────────────────────────────────────────────
  'state.loading': { es: 'Cargando…', en: 'Loading…' },
  'state.errorTitle': { es: 'Algo salió mal', en: 'Something went wrong' },
  'state.errorBody': {
    es: 'No pudimos cargar esto. Inténtalo de nuevo.',
    en: "We couldn't load this. Please try again.",
  },
  'state.offlineTitle': { es: 'Sin conexión', en: "You're offline" },
  'state.offlineBody': {
    es: 'Revisa tu conexión. Algunas funciones no están disponibles.',
    en: 'Check your connection. Some features are unavailable.',
  },
} as const;

export type StringKey = keyof typeof strings;
