// ─── i18n — Bilingual ES/EN translation system ─────────────────────────────
// Usage: const t = T[lang];  then t.nav.services, t.hero.headline, etc.
// Default language: 'es'

const T = {
  es: {
    nav: {
      services: "Servicios",
      howItWorks: "Cómo funciona",
      testimonials: "Testimonios",
      partners: "Partners",
      helpCenter: "Help Center",
      login: "Iniciar sesión",
      signup: "Crear cuenta",
    },
    hero: {
      headline: "Servicios a domicilio.",
      headlineBold: "Sin complicaciones.",
      sub: "Desde limpieza hasta reparaciones — encuentra al especialista ideal en minutos, no en días.",
      cta: "Solicitar servicio",
    },
    categories: {
      title: "Explora nuestros servicios",
      cleaning: "Limpieza",
      cleaningDesc: "Hogar, oficina, jardín y más",
      repair: "Reparación y Mantenimiento",
      repairDesc: "Plomería, electricidad, técnicos",
      wellness: "Bienestar y Cuidado Personal",
      wellnessDesc: "Cuidado personal a domicilio",
      maintenance: "Mantenimiento",
      maintenanceDesc: "Preventivo e instalaciones",
      supply: "Abastecimiento y Compras",
      supplyDesc: "Compras, entregas y mandados",
      custom: "Personalizado",
      customDesc: "Descríbelo y te lo buscamos",
    },
    how: {
      title: "Así de fácil",
      s1t: "Elige tu servicio",
      s1d: "Selecciona la categoría y describe lo que necesitas.",
      s2t: "SERVI Match",
      s2d: "Te asignamos al especialista verificado más cercano.",
      s3t: "Listo",
      s3d: "Tu especialista llega. Nosotros nos encargamos del resto.",
    },
    about: {
      title: "¿Por qué SERVI?",
      sub: "Hoy puedes pedir comida o un taxi en segundos, pero encontrar un plomero o un electricista sigue siendo lento, informal y desorganizado.",
      bold: "SERVI gestiona todo el proceso por ti.",
      stats: [
        { num: "500+", label: "Servicios realizados" },
        { num: "98%", label: "Satisfacción" },
        { num: "50+", label: "Especialistas verificados" },
        { num: "24h", label: "Tiempo promedio de respuesta" },
      ],
    },
    app: {
      title: "La app de SERVI",
      badge: "Muy pronto",
      sub: "Solicita servicios, da seguimiento y paga — todo desde tu celular.",
    },
    testimonials: {
      title: "Nuestros clientes",
      items: [
        { text: "Un proceso bastante sencillo. No me tuve que preocupar por investigar ni en contactar al especialista. Ya no tengo que estar preguntando en grupos por especialistas.", author: "Diego Flores" },
        { text: "Mi calentador dejó de funcionar y no sabía a quién acudir. A través de SERVI me conectaron con el especialista indicado, detectó que faltaba una pieza y ellos se encargaron de conseguirla, instalarla y dejar todo funcionando. Muy práctico!", author: "Patricia Espinoza" },
        { text: "¡Una alternativa más segura! Me ayudaron sustituir a mi jardinero, con quien estaba teniendo problemas. ¡Estoy más tranquila sabiendo que tengo el respaldo de un intermediario por cualquier cosa!", author: "Valeria Sanchez" },
      ],
    },
    providers: {
      title: "¿Eres proveedor de servicios?",
      sub: "Ofrece tus servicios con SERVI y haz crecer tu clientela de manera gratuita.",
      cta1: "Guía para ganar con SERVI",
      cta2: "Aplicar como Partner",
    },
    contact: {
      title: "Contacto",
      address: "Santa Fe, Cuajimalpa de Morelos, Ciudad de México, CDMX.",
      email: "serv.clientserv@gmail.com",
      whatsapp: "WhatsApp",
    },
    cta: {
      request: "Solicita tu servicio",
    },
    footer: {
      servi: "SERVI",
      partners: "Partners",
      help: "Ayuda",
      legal: "Legal",
      copyright: "© 2026 SERVI. Todos los derechos reservados.",
      links: {
        solicita: "Solicita",
        whatWeOffer: "Qué ofrecemos",
        how: "Cómo funciona",
        app: "App",
        testimonials: "Testimonios",
        bePartner: "Quiero ser partner",
        whatIsPartner: "Qué es ser Partner",
        howPartner: "Cómo ser Partner",
        handbook: "Handbook",
        report: "Reportar/sugerencia",
        whoWeAre: "Quiénes Somos",
        contactUs: "Contáctanos",
        terms: "Términos",
        privacy: "Privacidad",
        cancellation: "Política de Cancelación",
        legal: "Aviso Legal",
      },
    },
    auth: {
      loginTitle: "Bienvenido de nuevo",
      signupTitle: "Crea tu cuenta",
      email: "Correo electrónico",
      password: "Contraseña",
      name: "Nombre completo",
      phone: "Teléfono",
      loginBtn: "Iniciar sesión",
      signupBtn: "Crear cuenta",
      switchToSignup: "¿No tienes cuenta?",
      switchToLogin: "¿Ya tienes cuenta?",
      or: "o",
      google: "Continuar con Google",
      apple: "Continuar con Apple",
    },
    booking: {
      title: "Solicitar servicio",
      back: "Volver",
      selectCategory: "Selecciona una categoría",
      describeNeed: "Describe lo que necesitas",
      descPlaceholder: "Ej: Necesito una limpieza profunda para departamento de 2 recámaras...",
      when: "¿Cuándo lo necesitas?",
      asap: "Lo antes posible",
      schedule: "Agendar fecha",
      date: "Fecha",
      time: "Hora",
      where: "¿Dónde?",
      addressPlaceholder: "Dirección completa",
      contactTitle: "Datos de contacto",
      namePlaceholder: "Tu nombre",
      phonePlaceholder: "Tu teléfono",
      emailPlaceholder: "Tu correo (opcional)",
      confirm: "Confirmar solicitud",
      confirmed: "¡Solicitud enviada!",
      confirmedSub: "Te contactaremos pronto por WhatsApp.",
      done: "Entendido",
    },
  },
  en: {
    nav: {
      services: "Services",
      howItWorks: "How it works",
      testimonials: "Testimonials",
      partners: "Partners",
      helpCenter: "Help Center",
      login: "Log in",
      signup: "Sign up",
    },
    hero: {
      headline: "Home services.",
      headlineBold: "Made simple.",
      sub: "From cleaning to repairs — find the right specialist in minutes, not days.",
      cta: "Request a service",
    },
    categories: {
      title: "Explore our services",
      cleaning: "Cleaning",
      cleaningDesc: "Home, office, garden & more",
      repair: "Repair & Maintenance",
      repairDesc: "Plumbing, electrical, technicians",
      wellness: "Wellness & Personal Care",
      wellnessDesc: "Personal care at your door",
      maintenance: "Maintenance",
      maintenanceDesc: "Preventive & installations",
      supply: "Supply & Shopping",
      supplyDesc: "Shopping, deliveries & errands",
      custom: "Custom",
      customDesc: "Describe it, we'll find it",
    },
    how: {
      title: "It's that easy",
      s1t: "Choose your service",
      s1d: "Select a category and describe what you need.",
      s2t: "SERVI Match",
      s2d: "We assign the closest verified specialist to you.",
      s3t: "Done",
      s3d: "Your specialist arrives. We handle the rest.",
    },
    about: {
      title: "Why SERVI?",
      sub: "Today you can order food or a ride in seconds, but finding a plumber or electrician is still slow, informal, and disorganized.",
      bold: "SERVI manages the entire process for you.",
      stats: [
        { num: "500+", label: "Services completed" },
        { num: "98%", label: "Satisfaction" },
        { num: "50+", label: "Verified specialists" },
        { num: "24h", label: "Avg response time" },
      ],
    },
    app: {
      title: "The SERVI app",
      badge: "Coming soon",
      sub: "Request services, track progress, and pay — all from your phone.",
    },
    testimonials: {
      title: "Our clients",
      items: [
        { text: "A really simple process. I didn't have to worry about researching or contacting the specialist. No more asking around in groups for recommendations.", author: "Diego Flores" },
        { text: "My water heater broke and I didn't know who to call. SERVI connected me with the right specialist, who found the issue and handled everything from sourcing the part to installation.", author: "Patricia Espinoza" },
        { text: "A much safer alternative! They helped me replace my gardener, who I was having problems with. I feel much more at ease knowing I have SERVI backing me up!", author: "Valeria Sanchez" },
      ],
    },
    providers: {
      title: "Are you a service provider?",
      sub: "Offer your services with SERVI and grow your client base for free.",
      cta1: "Guide to earning with SERVI",
      cta2: "Apply as a Partner",
    },
    contact: {
      title: "Contact",
      address: "Santa Fe, Cuajimalpa de Morelos, Mexico City, CDMX.",
      email: "serv.clientserv@gmail.com",
      whatsapp: "WhatsApp",
    },
    cta: {
      request: "Request your service",
    },
    footer: {
      servi: "SERVI",
      partners: "Partners",
      help: "Help",
      legal: "Legal",
      copyright: "© 2026 SERVI. All rights reserved.",
      links: {
        solicita: "Request",
        whatWeOffer: "What we offer",
        how: "How it works",
        app: "App",
        testimonials: "Testimonials",
        bePartner: "Become a partner",
        whatIsPartner: "What is a Partner",
        howPartner: "How to be a Partner",
        handbook: "Handbook",
        report: "Report/suggestion",
        whoWeAre: "Who we are",
        contactUs: "Contact us",
        terms: "Terms",
        privacy: "Privacy",
        cancellation: "Cancellation Policy",
        legal: "Legal Notice",
      },
    },
    auth: {
      loginTitle: "Welcome back",
      signupTitle: "Create your account",
      email: "Email",
      password: "Password",
      name: "Full name",
      phone: "Phone",
      loginBtn: "Log in",
      signupBtn: "Sign up",
      switchToSignup: "Don't have an account?",
      switchToLogin: "Already have an account?",
      or: "or",
      google: "Continue with Google",
      apple: "Continue with Apple",
    },
    booking: {
      title: "Request a service",
      back: "Back",
      selectCategory: "Select a category",
      describeNeed: "Describe what you need",
      descPlaceholder: "E.g.: I need a deep cleaning for a 2-bedroom apartment...",
      when: "When do you need it?",
      asap: "As soon as possible",
      schedule: "Schedule a date",
      date: "Date",
      time: "Time",
      where: "Where?",
      addressPlaceholder: "Full address",
      contactTitle: "Contact information",
      namePlaceholder: "Your name",
      phonePlaceholder: "Your phone",
      emailPlaceholder: "Your email (optional)",
      confirm: "Confirm request",
      confirmed: "Request sent!",
      confirmedSub: "We'll contact you soon via WhatsApp.",
      done: "Got it",
    },
  },
};

// ─── Language helpers ────────────────────────────────────────────────────────
function getStoredLang() {
  try { return localStorage.getItem('servi-lang') || 'es'; } catch { return 'es'; }
}
function setStoredLang(lang) {
  try { localStorage.setItem('servi-lang', lang); } catch {}
}

// Global state — other scripts read window.__lang and window.__t
window.__lang = getStoredLang();
window.__t = T[window.__lang];
window.__T = T;

function setLang(lang) {
  window.__lang = lang;
  window.__t = T[lang];
  setStoredLang(lang);
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = key.split('.').reduce((o, k) => o?.[k], window.__t);
    if (val != null) el.textContent = val;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const val = key.split('.').reduce((o, k) => o?.[k], window.__t);
    if (val != null) el.placeholder = val;
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    const val = key.split('.').reduce((o, k) => o?.[k], window.__t);
    if (val != null) el.innerHTML = val;
  });
  // Update lang toggle buttons
  document.querySelectorAll('.lang-btn').forEach(btn => {
    const btnLang = btn.getAttribute('data-lang');
    btn.classList.toggle('lang-active', btnLang === lang);
    btn.classList.toggle('lang-inactive', btnLang !== lang);
  });
  // Fire custom event so components can react
  window.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
}

window.setLang = setLang;
window.T = T;
