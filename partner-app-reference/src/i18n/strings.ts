/**
 * SERVI Partner bilingual strings — Spanish default, English secondary.
 *
 * Mirrors the customer app's i18n model. Tone note: the partner app addresses
 * the specialist as "tú" and uses trade vocabulary, not marketing copy. Money
 * words are concrete ("Ganas", "Te depositamos") because vagueness about pay is
 * exactly what makes gig platforms feel adversarial.
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
  'common.skip': { es: 'Omitir por ahora', en: 'Skip for now' },
  'common.today': { es: 'Hoy', en: 'Today' },
  'common.tomorrow': { es: 'Mañana', en: 'Tomorrow' },
  'common.min': { es: 'min', en: 'min' },
  'common.hr': { es: 'h', en: 'h' },
  'common.km': { es: 'km', en: 'km' },
  'common.send': { es: 'Enviar', en: 'Send' },
  'common.understood': { es: 'Entendido', en: 'Got it' },

  // ── Tabs ─────────────────────────────────────────────────
  'tab.today': { es: 'Hoy', en: 'Today' },
  'tab.jobs': { es: 'Trabajos', en: 'Jobs' },
  'tab.earnings': { es: 'Ganancias', en: 'Earnings' },
  'tab.profile': { es: 'Perfil', en: 'Profile' },

  // ── Auth ─────────────────────────────────────────────────
  'auth.title': { es: 'Panel del especialista', en: 'Specialist panel' },
  'auth.subtitle': {
    es: 'Entra con tu número. Te enviamos un código por SMS.',
    en: 'Sign in with your number. We text you a code.',
  },
  'auth.phoneLabel': { es: 'Número de celular', en: 'Mobile number' },
  'auth.sendCode': { es: 'Enviar código', en: 'Send code' },
  'auth.otpTitle': { es: 'Ingresa tu código', en: 'Enter your code' },
  'auth.otpSubtitle': { es: 'Enviado a {phone}', en: 'Sent to {phone}' },
  'auth.resend': { es: 'Reenviar código', en: 'Resend code' },
  'auth.verify': { es: 'Verificar', en: 'Verify' },
  'auth.noAccount': { es: '¿Aún no eres SERVI Partner?', en: 'Not a SERVI Partner yet?' },
  'auth.apply': { es: 'Postúlate gratis', en: 'Apply for free' },
  'auth.sending': { es: 'Enviando…', en: 'Sending…' },
  'auth.error.sms': {
    es: 'No pudimos enviar el código. Revisa el número e intenta de nuevo.',
    en: "We couldn't send the code. Check the number and try again.",
  },
  'auth.error.code': { es: 'Código incorrecto. Intenta de nuevo.', en: 'Wrong code. Try again.' },
  'auth.error.notProvider': {
    es: 'Este número no está registrado como especialista SERVI. Postúlate gratis para empezar.',
    en: 'This number is not registered as a SERVI specialist. Apply for free to get started.',
  },
  'auth.error.unavailable': {
    es: 'Inicia sesión desde la app instalada — no disponible en esta vista previa.',
    en: 'Sign-in requires the installed app — not available in this preview.',
  },
  'auth.signedOutBody': {
    es: 'Inicia sesión con tu número registrado para ver tus trabajos y ofertas.',
    en: 'Sign in with your registered number to see your jobs and offers.',
  },
  'auth.demoHint': {
    es: 'Prototipo — cualquier código de 6 dígitos entra.',
    en: 'Prototype — any 6-digit code works.',
  },

  // ── Onboarding ───────────────────────────────────────────
  'onb.welcome.eyebrow': { es: 'SERVI Partners', en: 'SERVI Partners' },
  'onb.welcome.title': { es: 'Tu oficio, con respaldo', en: 'Your trade, backed' },
  'onb.welcome.subtitle': {
    es: 'Recibe trabajos cerca de ti, cobra siempre y quédate con el 100% de tu precio.',
    en: 'Get jobs near you, always get paid, and keep 100% of your price.',
  },
  'onb.welcome.p1t': { es: 'Cobras siempre', en: 'You always get paid' },
  'onb.welcome.p1b': {
    es: 'SERVI retiene el pago del cliente antes de que llegues. El trabajo nunca empieza sin dinero apartado.',
    en: 'SERVI holds the client’s payment before you arrive. Work never starts without money set aside.',
  },
  'onb.welcome.p2t': { es: 'Te quedas con el 100%', en: 'You keep 100%' },
  'onb.welcome.p2b': {
    es: 'Tu precio es tuyo completo. La comisión de SERVI la paga el cliente aparte, no sale de ti.',
    en: 'Your price is entirely yours. SERVI’s fee is paid by the client on top, never deducted from you.',
  },
  'onb.welcome.p3t': { es: 'Clientes sin buscarlos', en: 'Clients without chasing' },
  'onb.welcome.p3b': {
    es: 'Nosotros conseguimos, filtramos y agendamos. Tú solo llegas y trabajas.',
    en: 'We find, screen and schedule them. You just show up and work.',
  },
  'onb.welcome.cta': { es: 'Empezar mi registro', en: 'Start my application' },
  'onb.welcome.signin': { es: 'Ya tengo cuenta', en: 'I already have an account' },
  'onb.welcome.time': { es: 'Toma ~8 minutos', en: 'Takes ~8 minutes' },

  'onb.step': { es: 'Paso {n} de {total}', en: 'Step {n} of {total}' },

  'onb.identity.title': { es: '¿Quién eres?', en: 'Who are you?' },
  'onb.identity.subtitle': {
    es: 'Como aparece en tu identificación oficial.',
    en: 'As it appears on your official ID.',
  },
  'onb.identity.first': { es: 'Nombre(s)', en: 'First name(s)' },
  'onb.identity.last': { es: 'Apellidos', en: 'Last name(s)' },
  'onb.identity.phone': { es: 'Celular (WhatsApp)', en: 'Mobile (WhatsApp)' },
  'onb.identity.email': { es: 'Correo electrónico', en: 'Email' },
  'onb.identity.city': { es: 'Alcaldía o municipio', en: 'Borough or municipality' },

  'onb.services.title': { es: '¿Qué sabes hacer?', en: 'What do you do?' },
  'onb.services.subtitle': {
    es: 'Elige tus oficios. Puedes escoger varios y cambiarlos después.',
    en: 'Pick your trades. Choose several and change them later.',
  },
  'onb.services.skills': { es: 'Servicios específicos', en: 'Specific services' },
  'onb.services.skillsHint': {
    es: 'Mientras más específico, mejores trabajos te llegan.',
    en: 'The more specific you are, the better your job matches.',
  },
  'onb.services.selected': { es: '{n} seleccionados', en: '{n} selected' },
  'onb.services.selected.one': { es: '1 seleccionado', en: '1 selected' },

  'onb.coverage.title': { es: '¿Dónde trabajas?', en: 'Where do you work?' },
  'onb.coverage.subtitle': {
    es: 'Solo recibirás trabajos dentro de tu zona.',
    en: 'You’ll only receive jobs inside your zone.',
  },
  'onb.coverage.zones': { es: 'Colonias que cubres', en: 'Neighborhoods you cover' },
  'onb.coverage.radius': { es: 'Distancia máxima', en: 'Maximum distance' },
  'onb.coverage.asap': { es: 'Acepto trabajos urgentes', en: 'I accept urgent jobs' },
  'onb.coverage.asapHint': {
    es: 'Los trabajos "lo antes posible" pagan más y llegan primero a quien los acepta.',
    en: '“As soon as possible” jobs pay more and go first to whoever takes them.',
  },

  'onb.docs.title': { es: 'Verificación', en: 'Verification' },
  'onb.docs.subtitle': {
    es: 'Los clientes entran a su casa contigo. Esto es lo que nos permite responder por ti.',
    en: 'Clients let you into their home. This is what lets us vouch for you.',
  },
  'onb.docs.upload': { es: 'Subir', en: 'Upload' },
  'onb.docs.replace': { es: 'Reemplazar', en: 'Replace' },
  'onb.docs.mockNote': {
    es: 'Prototipo — al tocar "Subir" se simula el archivo, no se sube nada.',
    en: 'Prototype — tapping “Upload” simulates a file; nothing is uploaded.',
  },

  'onb.payout.title': { es: '¿Dónde te depositamos?', en: 'Where do we pay you?' },
  'onb.payout.subtitle': {
    es: 'Depósito automático cada lunes a tu cuenta. Sin comisión.',
    en: 'Automatic deposit every Monday to your account. No fee.',
  },
  'onb.payout.holder': { es: 'Titular de la cuenta', en: 'Account holder' },
  'onb.payout.clabe': { es: 'CLABE interbancaria (18 dígitos)', en: 'CLABE (18 digits)' },
  'onb.payout.rfc': { es: 'RFC', en: 'RFC (tax ID)' },
  'onb.payout.rfcHint': {
    es: 'Opcional por ahora. Lo necesitarás para facturar al superar $2,000 al mes.',
    en: 'Optional for now. Needed for invoicing once you pass $2,000 a month.',
  },
  'onb.payout.secure': {
    es: 'Tus datos bancarios se procesan con Stripe. SERVI nunca los guarda.',
    en: 'Your bank details are processed by Stripe. SERVI never stores them.',
  },

  'onb.review.title': { es: 'Revisa tu registro', en: 'Review your application' },
  'onb.review.terms': {
    es: 'Acepto los Términos de SERVI Partners y el Código de Conducta.',
    en: 'I accept the SERVI Partners Terms and Code of Conduct.',
  },
  'onb.review.submit': { es: 'Enviar registro', en: 'Submit application' },

  'onb.submitted.title': { es: 'Registro enviado', en: 'Application sent' },
  'onb.submitted.body': {
    es: 'Revisamos tus documentos en 24–48 horas. Te avisamos por WhatsApp en cuanto quedes verificado.',
    en: 'We review your documents in 24–48 hours. We’ll message you on WhatsApp once you’re verified.',
  },
  'onb.submitted.explore': { es: 'Explorar la app mientras', en: 'Explore the app meanwhile' },

  // ── Today ────────────────────────────────────────────────
  'today.greetingMorning': { es: 'Buenos días', en: 'Good morning' },
  'today.greetingAfternoon': { es: 'Buenas tardes', en: 'Good afternoon' },
  'today.greetingEvening': { es: 'Buenas noches', en: 'Good evening' },
  'today.onDuty': { es: 'En turno', en: 'On duty' },
  'today.offDuty': { es: 'Fuera de turno', en: 'Off duty' },
  'today.onDutyHint': {
    es: 'Recibiendo trabajos en tu zona',
    en: 'Receiving jobs in your area',
  },
  'today.offDutyHint': {
    es: 'No recibirás trabajos nuevos',
    en: 'You won’t receive new jobs',
  },
  'today.todayEarnings': { es: 'Hoy llevas', en: 'Today so far' },
  'today.todayJobs': { es: '{n} trabajos', en: '{n} jobs' },
  'today.todayJobs.one': { es: '1 trabajo', en: '1 job' },
  'today.nextJob': { es: 'Tu siguiente trabajo', en: 'Your next job' },
  'today.inProgress': { es: 'Trabajo en curso', en: 'Job in progress' },
  'today.offers': { es: 'Trabajos disponibles', en: 'Available jobs' },
  'today.offersHint': {
    es: 'Asignados a ti por tu zona y oficio',
    en: 'Matched to you by area and trade',
  },
  'today.schedule': { es: 'Agenda de hoy', en: 'Today’s schedule' },
  'today.emptyToday': { es: 'Nada agendado hoy', en: 'Nothing scheduled today' },
  'today.emptyTodayBody': {
    es: 'Ponte en turno para recibir trabajos disponibles en tu zona.',
    en: 'Go on duty to receive available jobs in your area.',
  },
  'today.emptyOffers': { es: 'Sin trabajos disponibles', en: 'No jobs available' },
  'today.emptyOffersBody': {
    es: 'Te avisamos en cuanto entre uno que empate con tu oficio y tu zona.',
    en: 'We’ll notify you the moment one matches your trade and area.',
  },
  'today.pendingVerification': { es: 'Verificación en curso', en: 'Verification in progress' },
  'today.pendingVerificationBody': {
    es: 'Aún revisamos tus documentos. En cuanto quedes verificado empezarás a recibir trabajos.',
    en: 'We’re still reviewing your documents. You’ll start receiving jobs once verified.',
  },

  // ── Jobs / offers ────────────────────────────────────────
  'jobs.title': { es: 'Trabajos', en: 'Jobs' },
  'jobs.segOffers': { es: 'Disponibles', en: 'Available' },
  'jobs.segUpcoming': { es: 'Agendados', en: 'Scheduled' },
  'jobs.segHistory': { es: 'Historial', en: 'History' },
  'jobs.emptyUpcoming': { es: 'Sin trabajos agendados', en: 'No scheduled jobs' },
  'jobs.emptyUpcomingBody': {
    es: 'Acepta un trabajo disponible y aparecerá aquí con la dirección completa.',
    en: 'Accept an available job and it shows up here with the full address.',
  },
  'jobs.emptyHistory': { es: 'Aún sin historial', en: 'No history yet' },
  'jobs.emptyHistoryBody': {
    es: 'Tus trabajos terminados y sus pagos aparecerán aquí.',
    en: 'Your finished jobs and their payments will appear here.',
  },

  'offer.youEarn': { es: 'Ganas', en: 'You earn' },
  'offer.expiresIn': { es: 'Expira en {time}', en: 'Expires in {time}' },
  'offer.expired': { es: 'Expiró', en: 'Expired' },
  'offer.accept': { es: 'Aceptar trabajo', en: 'Accept job' },
  'offer.decline': { es: 'Rechazar', en: 'Decline' },
  'offer.accepted': { es: 'Trabajo aceptado', en: 'Job accepted' },
  'offer.acceptedBody': {
    es: 'Ya tienes la dirección completa. Te recordamos 1 hora antes.',
    en: 'You now have the full address. We’ll remind you 1 hour before.',
  },
  'offer.addressHidden': { es: 'Dirección exacta al aceptar', en: 'Exact address on accept' },
  'offer.declineTitle': { es: '¿Rechazar este trabajo?', en: 'Decline this job?' },
  'offer.declineBody': {
    es: 'Se lo ofreceremos a otro especialista. Rechazar mucho reduce los trabajos que te llegan.',
    en: 'We’ll offer it to another specialist. Declining often reduces the jobs you receive.',
  },
  'offer.declineConfirm': { es: 'Sí, rechazar', en: 'Yes, decline' },

  // ── Job detail ───────────────────────────────────────────
  'job.detail': { es: 'Detalle del trabajo', en: 'Job detail' },
  'job.whatClientNeeds': { es: 'Lo que pide el cliente', en: 'What the client needs' },
  'job.details': { es: 'Detalles', en: 'Details' },
  'job.attachments': { es: 'Adjuntos del cliente', en: 'Client attachments' },
  'job.photos': { es: '{n} fotos', en: '{n} photos' },
  'job.voice': { es: 'Nota de voz', en: 'Voice note' },
  'job.video': { es: 'Video', en: 'Video' },
  'job.where': { es: 'Dónde', en: 'Where' },
  'job.when': { es: 'Cuándo', en: 'When' },
  'job.asap': { es: 'Lo antes posible', en: 'As soon as possible' },
  'job.estimated': { es: 'Duración estimada', en: 'Estimated duration' },
  'job.openMaps': { es: 'Abrir en mapas', en: 'Open in maps' },
  'job.client': { es: 'Cliente', en: 'Client' },
  'job.jobsTogether': { es: '{n} trabajos contigo', en: '{n} jobs with you' },
  'job.jobsTogether.one': { es: '1 trabajo contigo', en: '1 job with you' },
  'job.firstTime': { es: 'Primera vez contigo', en: 'First time with you' },
  'job.trustsYou': { es: 'Te tiene como especialista de confianza', en: 'Has you as a trusted specialist' },
  'job.contact': { es: 'Contactar por SERVI', en: 'Contact via SERVI' },
  'job.contactHint': {
    es: 'Los mensajes pasan por SERVI. Así queda registro si algo se disputa.',
    en: 'Messages go through SERVI, so there’s a record if anything is disputed.',
  },
  'job.payment': { es: 'Tu pago', en: 'Your payment' },
  'job.youEarnFull': { es: 'Ganas por este trabajo', en: 'You earn for this job' },
  'job.heldLabel': { es: 'Pago del cliente apartado', en: 'Client payment held' },
  'job.heldBody': {
    es: 'SERVI ya retuvo {amount} en la tarjeta del cliente. Tu pago está garantizado desde antes de llegar.',
    en: 'SERVI has already held {amount} on the client’s card. Your payment is guaranteed before you arrive.',
  },
  'job.notHeldBody': {
    es: 'Apartamos el pago del cliente 24 h antes del servicio. Te avisamos cuando esté confirmado.',
    en: 'We hold the client’s payment 24 h before the service. We’ll tell you once it’s confirmed.',
  },
  'job.clientPays': { es: 'El cliente paga', en: 'Client pays' },
  'job.serviFee': { es: 'Comisión SERVI + procesamiento', en: 'SERVI fee + processing' },
  'job.feeNote': {
    es: 'La comisión la paga el cliente aparte. A ti no se te descuenta nada.',
    en: 'The fee is paid by the client on top. Nothing is deducted from you.',
  },
  'job.cancelJob': { es: 'No puedo tomar este trabajo', en: 'I can’t take this job' },
  'job.cancelBody': {
    es: 'Avisa lo antes posible para reasignarlo. Cancelar tarde afecta tu confiabilidad.',
    en: 'Tell us as early as possible so we can reassign. Late cancellations hurt your reliability.',
  },

  // ── Check-in / phases ────────────────────────────────────
  'phase.title': { es: 'Registra tu avance', en: 'Log your progress' },
  'phase.hint': {
    es: 'El cliente ve cada paso en su app. Es lo que evita las llamadas de "¿ya vienes?".',
    en: 'The client sees each step in their app. It’s what stops the “are you coming?” calls.',
  },
  'phase.en_route': { es: 'Voy en camino', en: 'On my way' },
  'phase.arrived': { es: 'Llegué', en: 'I’ve arrived' },
  'phase.started': { es: 'Empecé el trabajo', en: 'Started the job' },
  'phase.completed': { es: 'Terminé', en: 'Finished' },
  'phase.en_route.done': { es: 'En camino', en: 'On the way' },
  'phase.arrived.done': { es: 'En el lugar', en: 'On site' },
  'phase.started.done': { es: 'Trabajando', en: 'Working' },
  'phase.completed.done': { es: 'Terminado', en: 'Finished' },
  'phase.shareLocation': { es: 'Compartir mi ubicación', en: 'Share my location' },
  'phase.locationShared': { es: 'Ubicación compartida', en: 'Location shared' },
  'phase.locationHint': {
    es: 'Una sola vez, no te rastreamos. El cliente ve dónde estás y deja de preguntar.',
    en: 'One time only — no tracking. The client sees where you are and stops asking.',
  },
  'phase.locationMock': {
    es: 'Prototipo — no se envía ninguna ubicación real.',
    en: 'Prototype — no real location is sent.',
  },

  // ── Price change ─────────────────────────────────────────
  'pc.title': { es: 'Ajustar el precio', en: 'Adjust the price' },
  'pc.subtitle': {
    es: 'Si el trabajo resultó mayor, pídelo aquí. SERVI le manda el cobro al cliente; tú no cobras en efectivo.',
    en: 'If the job turned out bigger, request it here. SERVI charges the client; you never collect cash.',
  },
  'pc.type': { es: '¿Por qué?', en: 'Why?' },
  'pc.type.precio_corregido': { es: 'Corrección de precio', en: 'Price correction' },
  'pc.type.horas_adicionales': { es: 'Horas adicionales', en: 'Additional hours' },
  'pc.type.servicio_adicional': { es: 'Servicio adicional', en: 'Additional service' },
  'pc.type.materiales': { es: 'Materiales', en: 'Materials' },
  'pc.type.otro': { es: 'Otro', en: 'Other' },
  'pc.amount': { es: 'Monto adicional para ti', en: 'Additional amount for you' },
  'pc.note': { es: 'Explica al cliente', en: 'Explain to the client' },
  'pc.notePlaceholder': {
    es: 'Ej. La fuga venía del tubo de la pared, no del WC. Requiere 2 horas más y un codo nuevo.',
    en: 'e.g. The leak came from the wall pipe, not the toilet. Needs 2 more hours and a new elbow joint.',
  },
  'pc.preview': { es: 'El cliente pagaría', en: 'The client would pay' },
  'pc.previewYou': { es: 'Tú recibes', en: 'You receive' },
  'pc.submit': { es: 'Enviar solicitud', en: 'Send request' },
  'pc.sent': { es: 'Solicitud enviada', en: 'Request sent' },
  'pc.sentBody': {
    es: 'SERVI la revisa y le manda el cobro al cliente. Te avisamos cuando lo autorice.',
    en: 'SERVI reviews it and sends the charge to the client. We’ll tell you once they approve.',
  },
  'pc.status.requested': { es: 'En revisión', en: 'Under review' },
  'pc.status.approved': { es: 'Autorizado', en: 'Approved' },
  'pc.status.rejected': { es: 'Rechazado', en: 'Declined' },
  'pc.status.paid': { es: 'Pagado', en: 'Paid' },
  'pc.existing': { es: 'Ajustes solicitados', en: 'Requested adjustments' },
  'pc.never': {
    es: 'Nunca cobres directo al cliente. Si pagas materiales, pídelo aquí y te lo reembolsamos con el trabajo.',
    en: 'Never charge the client directly. If you pay for materials, request it here and we reimburse it with the job.',
  },

  // ── Completion ───────────────────────────────────────────
  'done.title': { es: 'Cerrar el trabajo', en: 'Close the job' },
  'done.subtitle': {
    es: 'Con esto SERVI cobra al cliente y programa tu depósito.',
    en: 'This is what triggers SERVI charging the client and scheduling your deposit.',
  },
  'done.photos': { es: 'Foto del resultado', en: 'Photo of the result' },
  'done.photosHint': {
    es: 'Te protege si el cliente reclama después. Recomendado, no obligatorio.',
    en: 'Protects you if the client complains later. Recommended, not required.',
  },
  'done.addPhoto': { es: 'Agregar foto', en: 'Add photo' },
  'done.notes': { es: 'Notas para SERVI', en: 'Notes for SERVI' },
  'done.notesPlaceholder': {
    es: 'Algo que debamos saber sobre este trabajo…',
    en: 'Anything we should know about this job…',
  },
  'done.confirm': { es: 'Confirmo que terminé', en: 'I confirm I finished' },
  'done.finish': { es: 'Terminar trabajo', en: 'Finish job' },
  'done.finished': { es: '¡Trabajo terminado!', en: 'Job finished!' },
  'done.finishedBody': {
    es: 'Cobramos al cliente hoy. Tu pago de {amount} entra en el depósito del lunes.',
    en: 'We charge the client today. Your {amount} is included in Monday’s deposit.',
  },
  'done.rate': { es: '¿Cómo estuvo el cliente?', en: 'How was the client?' },
  'done.rateHint': {
    es: 'Tu calificación es privada y nos ayuda a filtrar clientes difíciles.',
    en: 'Your rating is private and helps us screen difficult clients.',
  },

  // ── Earnings ─────────────────────────────────────────────
  'earn.title': { es: 'Ganancias', en: 'Earnings' },
  'earn.available': { es: 'Disponible', en: 'Available' },
  'earn.availableHint': { es: 'Listo para depositar', en: 'Ready to deposit' },
  'earn.pending': { es: 'En proceso', en: 'Processing' },
  'earn.pendingHint': {
    es: 'Trabajos terminados que SERVI aún está cobrando al cliente',
    en: 'Finished jobs SERVI is still charging the client for',
  },
  'earn.scheduled': { es: 'Agendado', en: 'Scheduled' },
  'earn.scheduledHint': {
    es: 'Trabajos que ya aceptaste y todavía no haces',
    en: 'Jobs you accepted and haven’t done yet',
  },
  'earn.thisWeek': { es: 'Esta semana', en: 'This week' },
  'earn.thisMonth': { es: 'Este mes', en: 'This month' },
  'earn.jobsCount': { es: '{n} trabajos', en: '{n} jobs' },
  'earn.jobsCount.one': { es: '1 trabajo', en: '1 job' },
  'earn.cashOut': { es: 'Retirar ahora', en: 'Cash out now' },
  'earn.cashOutFee': { es: 'Comisión {fee} · llega en minutos', en: '{fee} fee · arrives in minutes' },
  'earn.nextPayout': { es: 'Próximo depósito', en: 'Next deposit' },
  'earn.nextPayoutBody': {
    es: '{amount} el {date} a tu cuenta ••••{last4}. Sin comisión.',
    en: '{amount} on {date} to your ••••{last4} account. No fee.',
  },
  'earn.breakdown': { es: 'Desglose por trabajo', en: 'Breakdown by job' },
  'earn.payouts': { es: 'Depósitos', en: 'Deposits' },
  'earn.payoutsAll': { es: 'Ver todos los depósitos', en: 'See all deposits' },
  'earn.payoutMethod': { es: 'Cuenta de depósito', en: 'Deposit account' },
  'earn.noAccount': { es: 'Falta tu cuenta bancaria', en: 'Bank account missing' },
  'earn.noAccountBody': {
    es: 'Sin cuenta no podemos depositarte. Tu dinero se acumula, no se pierde.',
    en: 'Without an account we can’t deposit. Your money accumulates, it isn’t lost.',
  },
  'earn.addAccount': { es: 'Agregar cuenta', en: 'Add account' },
  'earn.emptyBreakdown': { es: 'Sin ganancias todavía', en: 'No earnings yet' },
  'earn.emptyBreakdownBody': {
    es: 'Termina tu primer trabajo y el desglose aparece aquí.',
    en: 'Finish your first job and the breakdown appears here.',
  },
  'earn.taxTitle': { es: 'Constancia de ingresos', en: 'Income statement' },
  'earn.taxBody': {
    es: 'Descarga el resumen mensual que necesitas para declarar.',
    en: 'Download the monthly summary you need for taxes.',
  },

  'payout.status.pending': { es: 'Programado', en: 'Scheduled' },
  'payout.status.in_transit': { es: 'En camino', en: 'In transit' },
  'payout.status.paid': { es: 'Depositado', en: 'Deposited' },
  'payout.status.failed': { es: 'Falló', en: 'Failed' },
  'payout.instant': { es: 'Retiro inmediato', en: 'Instant cash out' },
  'payout.standard': { es: 'Depósito semanal', en: 'Weekly deposit' },
  'payout.jobsIncluded': { es: '{n} trabajos incluidos', en: '{n} jobs included' },
  'payout.jobsIncluded.one': { es: '1 trabajo incluido', en: '1 job included' },
  'payout.title': { es: 'Depósitos', en: 'Deposits' },
  'payout.empty': { es: 'Aún sin depósitos', en: 'No deposits yet' },
  'payout.emptyBody': {
    es: 'Tu primer depósito llega el lunes después de tu primer trabajo terminado.',
    en: 'Your first deposit arrives the Monday after your first finished job.',
  },

  // ── Profile ──────────────────────────────────────────────
  'prof.title': { es: 'Perfil', en: 'Profile' },
  'prof.verified': { es: 'Verificado', en: 'Verified' },
  'prof.pending': { es: 'En revisión', en: 'Under review' },
  'prof.paused': { es: 'En pausa', en: 'Paused' },
  'prof.rating': { es: 'Calificación', en: 'Rating' },
  'prof.satisfaction': { es: 'Satisfacción', en: 'Satisfaction' },
  'prof.jobs': { es: 'Trabajos', en: 'Jobs' },
  'prof.reliability': { es: 'Confiabilidad', en: 'Reliability' },
  'prof.trustedBy': { es: 'Te guardaron como especialista de confianza', en: 'Saved you as a trusted specialist' },
  'prof.trustedByN': { es: '{n} clientes', en: '{n} clients' },
  'prof.trustedByN.one': { es: '1 cliente', en: '1 client' },
  'prof.tier': { es: 'Nivel', en: 'Tier' },
  'prof.tierProgress': { es: '{n} trabajos para {next}', en: '{n} jobs to {next}' },
  'prof.tierProgress.one': { es: '1 trabajo para {next}', en: '1 job to {next}' },
  'prof.tierMax': { es: 'Nivel máximo alcanzado', en: 'Top tier reached' },
  'prof.perks': { es: 'Tus beneficios', en: 'Your perks' },
  'prof.myTrades': { es: 'Mis oficios', en: 'My trades' },
  'prof.availability': { es: 'Disponibilidad', en: 'Availability' },
  'prof.coverage': { es: 'Zona de trabajo', en: 'Work area' },
  'prof.documents': { es: 'Documentos', en: 'Documents' },
  'prof.payoutAccount': { es: 'Cuenta de depósito', en: 'Deposit account' },
  'prof.whyServi': { es: 'Por qué SERVI', en: 'Why SERVI' },
  'prof.whyServiHint': { es: 'Lo que ganas por trabajar con nosotros', en: 'What you gain by working with us' },
  'prof.handbook': { es: 'Manual del especialista', en: 'Specialist handbook' },
  'prof.help': { es: 'Ayuda y soporte', en: 'Help and support' },
  'prof.language': { es: 'Idioma', en: 'Language' },
  'prof.signOut': { es: 'Cerrar sesión', en: 'Sign out' },
  'prof.memberSince': { es: 'Partner desde {date}', en: 'Partner since {date}' },

  // ── Availability ─────────────────────────────────────────
  'avail.title': { es: 'Disponibilidad', en: 'Availability' },
  'avail.subtitle': {
    es: 'Solo te ofrecemos trabajos dentro de tu horario.',
    en: 'We only offer you jobs inside your hours.',
  },
  'avail.day.mon': { es: 'Lunes', en: 'Monday' },
  'avail.day.tue': { es: 'Martes', en: 'Tuesday' },
  'avail.day.wed': { es: 'Miércoles', en: 'Wednesday' },
  'avail.day.thu': { es: 'Jueves', en: 'Thursday' },
  'avail.day.fri': { es: 'Viernes', en: 'Friday' },
  'avail.day.sat': { es: 'Sábado', en: 'Saturday' },
  'avail.day.sun': { es: 'Domingo', en: 'Sunday' },
  'avail.off': { es: 'Descanso', en: 'Off' },
  'avail.hoursWeek': { es: '{n} h disponibles a la semana', en: '{n} h available per week' },
  'avail.hoursWeek.one': { es: '1 h disponible a la semana', en: '1 h available per week' },

  // ── Coverage screen ──────────────────────────────────────
  'cov.title': { es: 'Zona de trabajo', en: 'Work area' },
  'cov.subtitle': {
    es: 'Entre más zonas cubras, más trabajos recibes.',
    en: 'The more areas you cover, the more jobs you receive.',
  },

  // ── Why SERVI (anti-disintermediation) ───────────────────
  'why.title': { es: 'Por qué SERVI', en: 'Why SERVI' },
  'why.subtitle': {
    es: 'Lo que un cliente directo no te da.',
    en: 'What a direct client doesn’t give you.',
  },
  'why.compare': { es: 'SERVI vs. por tu cuenta', en: 'SERVI vs. on your own' },
  'why.col.servi': { es: 'Con SERVI', en: 'With SERVI' },
  'why.col.direct': { es: 'Por tu cuenta', en: 'On your own' },

  'why.pay.t': { es: 'Cobro garantizado', en: 'Guaranteed payment' },
  'why.pay.servi': {
    es: 'El pago se aparta en la tarjeta del cliente antes de que llegues.',
    en: 'Payment is held on the client’s card before you arrive.',
  },
  'why.pay.direct': {
    es: '"Te pago el viernes". Persigues el dinero tú solo.',
    en: '“I’ll pay you Friday.” You chase the money alone.',
  },
  'why.cut.t': { es: 'Te quedas con tu precio completo', en: 'You keep your full price' },
  'why.cut.servi': {
    es: 'Ganas el 100% de lo que cotizas. La comisión la paga el cliente aparte.',
    en: 'You earn 100% of your quote. The fee is paid by the client, separately.',
  },
  'why.cut.direct': {
    es: 'Mismo precio, pero sin nada de lo demás.',
    en: 'Same price, but with none of the rest.',
  },
  'why.clients.t': { es: 'Clientes constantes', en: 'Steady clients' },
  'why.clients.servi': {
    es: 'Trabajos filtrados que llegan a tu teléfono. Sin volantes ni redes.',
    en: 'Screened jobs delivered to your phone. No flyers, no social media.',
  },
  'why.clients.direct': {
    es: 'Depende de recomendaciones y suerte.',
    en: 'Depends on referrals and luck.',
  },
  'why.disputes.t': { es: 'Alguien responde por ti', en: 'Someone backs you up' },
  'why.disputes.servi': {
    es: 'Si el cliente reclama, SERVI media con tu evidencia y tus check-ins.',
    en: 'If a client complains, SERVI mediates using your evidence and check-ins.',
  },
  'why.disputes.direct': {
    es: 'Tu palabra contra la suya.',
    en: 'Your word against theirs.',
  },
  'why.extra.t': { es: 'Cobrar de más, sin pelear', en: 'Charge more without arguing' },
  'why.extra.servi': {
    es: 'Pides el ajuste en la app y SERVI le cobra al cliente. Tú no negocias.',
    en: 'You request the adjustment in the app and SERVI charges the client. You don’t negotiate.',
  },
  'why.extra.direct': {
    es: 'Una conversación incómoda a media chamba.',
    en: 'An awkward conversation mid-job.',
  },
  'why.noshow.t': { es: 'Protección por cancelaciones', en: 'Cancellation protection' },
  'why.noshow.servi': {
    es: 'Si el cliente cancela tarde o no abre, te compensamos el viaje.',
    en: 'If the client cancels late or doesn’t open, we compensate your trip.',
  },
  'why.noshow.direct': {
    es: 'Viaje perdido, día perdido.',
    en: 'Wasted trip, wasted day.',
  },
  'why.growth.t': { es: 'Tu reputación es portátil', en: 'Your reputation is portable' },
  'why.growth.servi': {
    es: 'Cada trabajo suma a tu calificación, tu nivel y los clientes que te guardan.',
    en: 'Every job builds your rating, your tier, and the clients who save you.',
  },
  'why.growth.direct': {
    es: 'Empiezas de cero con cada cliente nuevo.',
    en: 'You start from zero with every new client.',
  },
  'why.footer': {
    es: 'Cobrar por fuera te quita todo lo de arriba y te saca de SERVI de forma permanente.',
    en: 'Taking payment off-platform removes everything above and permanently removes you from SERVI.',
  },

  // ── Help ─────────────────────────────────────────────────
  'help.title': { es: 'Ayuda', en: 'Help' },
  'help.contactTitle': { es: 'Habla con soporte', en: 'Talk to support' },
  'help.contactBody': {
    es: 'Escríbenos y te respondemos el mismo día.',
    en: 'Write to us and we reply the same day.',
  },
  'help.email': { es: 'Escribir a soporte', en: 'Email support' },
  'help.urgent': { es: '¿Emergencia en un trabajo?', en: 'Emergency on a job?' },
  'help.urgentBody': {
    es: 'Si hay riesgo, daño o el cliente se pone agresivo: sal del lugar y repórtalo de inmediato.',
    en: 'If there’s risk, damage, or the client becomes aggressive: leave and report it immediately.',
  },
  'help.report': { es: 'Reportar un problema', en: 'Report a problem' },
  'help.faq': { es: 'Preguntas frecuentes', en: 'Frequent questions' },

  'faq.q1': { es: '¿Cuándo me depositan?', en: 'When do I get paid?' },
  'faq.a1': {
    es: 'Cada lunes depositamos todo lo que terminaste hasta el domingo. También puedes retirar antes con una comisión pequeña.',
    en: 'Every Monday we deposit everything you finished through Sunday. You can also cash out earlier for a small fee.',
  },
  'faq.q2': { es: '¿Qué pasa si el cliente no está?', en: 'What if the client isn’t there?' },
  'faq.a2': {
    es: 'Marca "Llegué", espera 15 minutos y repórtalo. Te compensamos el viaje.',
    en: 'Mark “I’ve arrived”, wait 15 minutes and report it. We compensate your trip.',
  },
  'faq.q3': { es: '¿Puedo dar mi número al cliente?', en: 'Can I give the client my number?' },
  'faq.a3': {
    es: 'No. Todo pasa por SERVI para que quede registro y puedas cobrar garantizado. Compartir contacto o cobrar por fuera cancela tu cuenta.',
    en: 'No. Everything goes through SERVI so there’s a record and your payment stays guaranteed. Sharing contact details or charging off-platform closes your account.',
  },
  'faq.q4': { es: '¿Y si el trabajo es más grande de lo que decía?', en: 'What if the job is bigger than described?' },
  'faq.a4': {
    es: 'Usa "Ajustar el precio" antes de terminar. SERVI le cobra la diferencia al cliente.',
    en: 'Use “Adjust the price” before finishing. SERVI charges the client the difference.',
  },
  'faq.q5': { es: '¿Quién paga los materiales?', en: 'Who pays for materials?' },
  'faq.a5': {
    es: 'Si los compras tú, pídelos como ajuste tipo "Materiales" con tu ticket. Se te reembolsan con el pago del trabajo.',
    en: 'If you buy them, request them as a “Materials” adjustment with your receipt. They’re reimbursed with the job payment.',
  },

  // ── Demo controls ────────────────────────────────────────
  'demo.title': { es: 'Controles del prototipo', en: 'Prototype controls' },
  'demo.body': {
    es: 'Solo existen en esta demo, para poder ver todos los estados.',
    en: 'These exist only in this demo, so every state can be seen.',
  },
  'demo.newOffer': { es: 'Simular trabajo nuevo', en: 'Simulate a new job' },
  'demo.reset': { es: 'Reiniciar datos', en: 'Reset data' },
  'demo.status': { es: 'Estado de verificación', en: 'Verification status' },

  // ── Prototype banner ─────────────────────────────────────
  'proto.banner': {
    es: 'Prototipo de diseño · datos simulados',
    en: 'Design prototype · simulated data',
  },
} as const;

export type StringKey = keyof typeof strings;
