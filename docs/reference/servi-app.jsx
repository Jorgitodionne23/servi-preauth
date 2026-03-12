import { useState, useEffect, useRef } from "react";

// ─── i18n ───────────────────────────────────────────────
const T = {
  es: {
    nav: { services: "Servicios", howItWorks: "Cómo funciona", testimonials: "Testimonios", providers: "Proveedores", contact: "Contacto", login: "Iniciar sesión", signup: "Crear cuenta" },
    hero: {
      headline: "Servicios a domicilio.",
      headlineBold: "Sin complicaciones.",
      sub: "Desde limpieza hasta reparaciones — encuentra al especialista ideal en minutos, no en días.",
      cta: "Solicitar servicio",
      placeholder: "¿Qué servicio necesitas?",
    },
    categories: {
      title: "Explora nuestros servicios",
      cleaning: "Limpieza",
      cleaningDesc: "Hogar, oficina, jardín y más",
      repair: "Reparación",
      repairDesc: "Plomería, electricidad, técnicos",
      wellness: "Bienestar",
      wellnessDesc: "Cuidado personal a domicilio",
      maintenance: "Mantenimiento",
      maintenanceDesc: "Preventivo e instalaciones",
      supply: "Abastecimiento",
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
    testimonials: {
      title: "Nuestros clientes",
      items: [
        { text: "Un proceso bastante sencillo. No me tuve que preocupar por investigar ni en contactar al especialista. Ya no tengo que estar preguntando en grupos por especialistas.", author: "Diego Flores" },
        { text: "Mi calentador dejó de funcionar y no sabía a quién acudir. A través de SERVI me conectaron con el especialista indicado, detectó que faltaba una pieza y ellos se encargaron de conseguirla, instalarla y dejar todo funcionando.", author: "Patricia Espinoza" },
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
    },
    footer: {
      servi: "SERVI",
      partners: "Partners",
      help: "Ayuda",
      legal: "Legal",
      links: {
        solicita: "Solicita", whatWeOffer: "Qué ofrecemos", how: "Cómo funciona", app: "App", testimonials: "Testimonios",
        bePartner: "Quiero ser partner", whatIsPartner: "Qué es ser Partner", howPartner: "Cómo ser Partner", handbook: "Handbook",
        report: "Reportar/sugerencia", whoWeAre: "Quiénes Somos", contactUs: "Contáctanos",
        terms: "Términos", privacy: "Privacidad", cancellation: "Política de Cancelación", legal: "Aviso Legal",
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
      confirm: "Confirmar solicitud",
      confirmed: "¡Solicitud enviada!",
      confirmedSub: "Un especialista será asignado pronto. Te notificaremos por correo.",
      done: "Entendido",
      loginRequired: "Inicia sesión para solicitar un servicio",
      loginBtn: "Iniciar sesión",
    },
  },
  en: {
    nav: { services: "Services", howItWorks: "How it works", testimonials: "Testimonials", providers: "Providers", contact: "Contact", login: "Log in", signup: "Sign up" },
    hero: {
      headline: "Home services.",
      headlineBold: "Made simple.",
      sub: "From cleaning to repairs — find the right specialist in minutes, not days.",
      cta: "Request a service",
      placeholder: "What service do you need?",
    },
    categories: {
      title: "Explore our services",
      cleaning: "Cleaning",
      cleaningDesc: "Home, office, garden & more",
      repair: "Repair",
      repairDesc: "Plumbing, electrical, technicians",
      wellness: "Wellness",
      wellnessDesc: "Personal care at your door",
      maintenance: "Maintenance",
      maintenanceDesc: "Preventive & installations",
      supply: "Supply",
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
    },
    footer: {
      servi: "SERVI",
      partners: "Partners",
      help: "Help",
      legal: "Legal",
      links: {
        solicita: "Request", whatWeOffer: "What we offer", how: "How it works", app: "App", testimonials: "Testimonials",
        bePartner: "Become a partner", whatIsPartner: "What is a Partner", howPartner: "How to be a Partner", handbook: "Handbook",
        report: "Report/suggestion", whoWeAre: "Who we are", contactUs: "Contact us",
        terms: "Terms", privacy: "Privacy", cancellation: "Cancellation Policy", legal: "Legal Notice",
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
      confirm: "Confirm request",
      confirmed: "Request sent!",
      confirmedSub: "A specialist will be assigned soon. We'll notify you by email.",
      done: "Got it",
      loginRequired: "Log in to request a service",
      loginBtn: "Log in",
    },
  },
};

// ─── Icons (inline SVG components) ──────────────────────
const IconCleaning = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v6m0 0l-3-3m3 3l3-3" /><path d="M8 14h8" /><path d="M7 14l-2 8h14l-2-8" /><circle cx="12" cy="11" r="1" />
  </svg>
);
const IconRepair = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
  </svg>
);
const IconWellness = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
  </svg>
);
const IconMaintenance = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
);
const IconSupply = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18" /><path d="M16 10a4 4 0 01-8 0" />
  </svg>
);
const IconCustom = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
  </svg>
);
const IconArrow = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);
const IconCheck = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" />
  </svg>
);
const IconX = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);
const IconBack = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);
const IconWhatsApp = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);
const IconMail = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 4l-10 8L2 4"/>
  </svg>
);
const IconPin = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);

// ─── Main App ───────────────────────────────────────────
export default function ServiApp() {
  const [lang, setLang] = useState("es");
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [user, setUser] = useState(null);
  const [showBooking, setShowBooking] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const t = T[lang];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleRequestService = () => {
    if (!user) {
      setShowAuth(true);
      setAuthMode("login");
    } else {
      setShowBooking(true);
    }
  };

  const handleAuthSuccess = (userData) => {
    setUser(userData);
    setShowAuth(false);
    setShowBooking(true);
  };

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileMenu(false);
  };

  return (
    <div style={{ fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", color: "#0a0a0a", background: "#fafafa", minHeight: "100vh", overflowX: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,700;1,9..40,400&family=Syne:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        ::selection { background: #0a0a0a; color: #fff; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(100%); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        .nav-link { color: #555; text-decoration: none; font-size: 14px; font-weight: 500; transition: color 0.2s; letter-spacing: 0.01em; }
        .nav-link:hover { color: #0a0a0a; }
        .cat-card { background: #fff; border: 1px solid #e8e8e8; border-radius: 16px; padding: 28px 24px; cursor: pointer; transition: all 0.3s cubic-bezier(0.25,0.46,0.45,0.94); position: relative; overflow: hidden; }
        .cat-card:hover { border-color: #0a0a0a; transform: translateY(-4px); box-shadow: 0 20px 40px rgba(0,0,0,0.08); }
        .cat-card:hover .cat-arrow { opacity: 1; transform: translateX(0); }
        .cat-arrow { opacity: 0; transform: translateX(-8px); transition: all 0.3s; }
        .step-num { width: 48px; height: 48px; border-radius: 50%; background: #0a0a0a; color: #fff; display: flex; align-items: center; justify-content: center; font-family: 'Syne', sans-serif; font-weight: 700; font-size: 18px; flex-shrink: 0; }
        .testimonial-card { background: #fff; border-radius: 20px; padding: 32px; border: 1px solid #eee; transition: all 0.3s; }
        .testimonial-card:hover { box-shadow: 0 16px 48px rgba(0,0,0,0.06); transform: translateY(-2px); }
        .btn-primary { background: #0a0a0a; color: #fff; border: none; padding: 16px 32px; border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.25s; font-family: 'DM Sans', sans-serif; display: inline-flex; align-items: center; gap: 10px; }
        .btn-primary:hover { background: #222; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,0,0,0.15); }
        .btn-secondary { background: transparent; color: #0a0a0a; border: 1.5px solid #d0d0d0; padding: 16px 32px; border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.25s; font-family: 'DM Sans', sans-serif; }
        .btn-secondary:hover { border-color: #0a0a0a; background: #f5f5f5; }
        .input-field { width: 100%; padding: 14px 16px; border: 1.5px solid #e0e0e0; border-radius: 12px; font-size: 15px; font-family: 'DM Sans', sans-serif; transition: border-color 0.2s; outline: none; background: #fff; }
        .input-field:focus { border-color: #0a0a0a; }
        .input-field::placeholder { color: #aaa; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); z-index: 1000; display: flex; align-items: center; justify-content: center; animation: fadeIn 0.2s; }
        .modal-content { background: #fff; border-radius: 24px; max-width: 440px; width: 92%; max-height: 90vh; overflow-y: auto; animation: slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
        .booking-panel { position: fixed; inset: 0; background: #fafafa; z-index: 999; overflow-y: auto; animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        .lang-toggle { display: flex; background: #f0f0f0; border-radius: 8px; overflow: hidden; border: 1px solid #e0e0e0; }
        .lang-btn { padding: 6px 12px; font-size: 12px; font-weight: 600; border: none; cursor: pointer; transition: all 0.2s; font-family: 'DM Sans', sans-serif; letter-spacing: 0.03em; }
        .lang-active { background: #0a0a0a; color: #fff; }
        .lang-inactive { background: transparent; color: #888; }
        .stat-item { text-align: center; }
        .stat-num { font-family: 'Syne', sans-serif; font-size: 36px; font-weight: 800; color: #0a0a0a; line-height: 1; }
        .stat-label { font-size: 13px; color: #777; margin-top: 6px; letter-spacing: 0.02em; }
        .provider-section { background: #0a0a0a; color: #fff; border-radius: 32px; padding: 64px; margin: 0 24px; }
        @media (max-width: 768px) {
          .provider-section { padding: 40px 24px; margin: 0 16px; border-radius: 24px; }
          .hero-headline { font-size: 44px !important; }
          .section-title { font-size: 32px !important; }
          .stats-grid { grid-template-columns: 1fr 1fr !important; gap: 24px !important; }
          .cat-grid { grid-template-columns: 1fr !important; }
          .steps-grid { grid-template-columns: 1fr !important; }
          .test-grid { grid-template-columns: 1fr !important; }
          .about-layout { flex-direction: column !important; }
        }
        .hamburger { display: none; background: none; border: none; cursor: pointer; padding: 4px; }
        @media (max-width: 900px) {
          .desktop-nav { display: none !important; }
          .hamburger { display: block; }
        }
        .mobile-menu { position: fixed; top: 0; right: 0; bottom: 0; width: 280px; background: #fff; z-index: 1001; padding: 24px; box-shadow: -4px 0 24px rgba(0,0,0,0.1); animation: slideInRight 0.3s ease; }
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .mobile-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.3); z-index: 1000; }
        textarea.input-field { resize: vertical; min-height: 100px; }
        .radio-option { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border: 1.5px solid #e0e0e0; border-radius: 12px; cursor: pointer; transition: all 0.2s; }
        .radio-option:hover { border-color: #999; }
        .radio-selected { border-color: #0a0a0a; background: #f8f8f8; }
        .radio-dot { width: 20px; height: 20px; border-radius: 50%; border: 2px solid #ccc; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.2s; }
        .radio-selected .radio-dot { border-color: #0a0a0a; }
        .radio-selected .radio-dot::after { content: ''; width: 10px; height: 10px; border-radius: 50%; background: #0a0a0a; }
        .booking-cat { display: flex; align-items: center; gap: 16px; padding: 18px 20px; border: 1.5px solid #e8e8e8; border-radius: 14px; cursor: pointer; transition: all 0.25s; background: #fff; }
        .booking-cat:hover { border-color: #0a0a0a; background: #fafafa; }
        .booking-cat-active { border-color: #0a0a0a; background: #f5f5f5; }
        .divider { width: 100%; height: 1px; background: linear-gradient(to right, transparent, #ddd, transparent); margin: 0; }
      `}</style>

      {/* ═══ NAVBAR ═══ */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: scrolled ? "rgba(250,250,250,0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(0,0,0,0.06)" : "1px solid transparent",
        transition: "all 0.3s",
        padding: scrolled ? "12px 0" : "20px 0",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 26, letterSpacing: "-0.02em", cursor: "pointer" }} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            SERVI<span style={{ color: "#10b981" }}>.</span>
          </div>

          <div className="desktop-nav" style={{ display: "flex", alignItems: "center", gap: 32 }}>
            <a className="nav-link" onClick={() => scrollTo("services")}>{t.nav.services}</a>
            <a className="nav-link" onClick={() => scrollTo("how")}>{t.nav.howItWorks}</a>
            <a className="nav-link" onClick={() => scrollTo("testimonials")}>{t.nav.testimonials}</a>
            <a className="nav-link" onClick={() => scrollTo("providers")}>{t.nav.providers}</a>
            <a className="nav-link" onClick={() => scrollTo("contact")}>{t.nav.contact}</a>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="lang-toggle">
              <button className={`lang-btn ${lang === "es" ? "lang-active" : "lang-inactive"}`} onClick={() => setLang("es")}>ES</button>
              <button className={`lang-btn ${lang === "en" ? "lang-active" : "lang-inactive"}`} onClick={() => setLang("en")}>EN</button>
            </div>
            {user ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#0a0a0a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600 }}>
                  {user.name?.charAt(0)?.toUpperCase()}
                </div>
              </div>
            ) : (
              <div className="desktop-nav" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={() => { setShowAuth(true); setAuthMode("login"); }} style={{ background: "none", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", padding: "8px 16px", fontFamily: "'DM Sans'" }}>
                  {t.nav.login}
                </button>
                <button onClick={() => { setShowAuth(true); setAuthMode("signup"); }} style={{ background: "#0a0a0a", color: "#fff", border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer", padding: "10px 20px", borderRadius: 10, fontFamily: "'DM Sans'" }}>
                  {t.nav.signup}
                </button>
              </div>
            )}
            <button className="hamburger" onClick={() => setMobileMenu(true)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileMenu && (
        <>
          <div className="mobile-overlay" onClick={() => setMobileMenu(false)} />
          <div className="mobile-menu">
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 32 }}>
              <button onClick={() => setMobileMenu(false)} style={{ background: "none", border: "none", cursor: "pointer" }}><IconX /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {[["services", t.nav.services], ["how", t.nav.howItWorks], ["testimonials", t.nav.testimonials], ["providers", t.nav.providers], ["contact", t.nav.contact]].map(([id, label]) => (
                <a key={id} onClick={() => scrollTo(id)} style={{ fontSize: 18, fontWeight: 500, color: "#0a0a0a", textDecoration: "none", cursor: "pointer" }}>{label}</a>
              ))}
              <div style={{ height: 1, background: "#eee", margin: "8px 0" }} />
              {!user && (
                <>
                  <button onClick={() => { setMobileMenu(false); setShowAuth(true); setAuthMode("login"); }} style={{ background: "none", border: "none", fontSize: 16, fontWeight: 600, cursor: "pointer", textAlign: "left", fontFamily: "'DM Sans'" }}>{t.nav.login}</button>
                  <button onClick={() => { setMobileMenu(false); setShowAuth(true); setAuthMode("signup"); }} className="btn-primary" style={{ justifyContent: "center" }}>{t.nav.signup}</button>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* ═══ HERO ═══ */}
      <section style={{ paddingTop: 140, paddingBottom: 80, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -200, right: -200, width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -100, left: -100, width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", position: "relative" }}>
          <div style={{ maxWidth: 720, animation: "fadeUp 0.8s ease" }}>
            <h1 className="hero-headline" style={{ fontFamily: "'Syne', sans-serif", fontSize: 68, fontWeight: 800, lineHeight: 1.02, letterSpacing: "-0.03em", marginBottom: 24 }}>
              {t.hero.headline}<br />
              <span style={{ background: "linear-gradient(135deg, #10b981, #059669)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                {t.hero.headlineBold}
              </span>
            </h1>
            <p style={{ fontSize: 19, color: "#666", lineHeight: 1.6, maxWidth: 520, marginBottom: 40, fontWeight: 400 }}>
              {t.hero.sub}
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button className="btn-primary" onClick={handleRequestService} style={{ padding: "18px 36px", fontSize: 16 }}>
                {t.hero.cta} <IconArrow />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ SERVICES ═══ */}
      <section id="services" style={{ padding: "60px 0 80px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
          <h2 className="section-title" style={{ fontFamily: "'Syne', sans-serif", fontSize: 40, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 48 }}>
            {t.categories.title}
          </h2>
          <div className="cat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {[
              { icon: <IconCleaning />, name: t.categories.cleaning, desc: t.categories.cleaningDesc, key: "cleaning" },
              { icon: <IconRepair />, name: t.categories.repair, desc: t.categories.repairDesc, key: "repair" },
              { icon: <IconWellness />, name: t.categories.wellness, desc: t.categories.wellnessDesc, key: "wellness" },
              { icon: <IconMaintenance />, name: t.categories.maintenance, desc: t.categories.maintenanceDesc, key: "maintenance" },
              { icon: <IconSupply />, name: t.categories.supply, desc: t.categories.supplyDesc, key: "supply" },
              { icon: <IconCustom />, name: t.categories.custom, desc: t.categories.customDesc, key: "custom" },
            ].map((cat, i) => (
              <div key={cat.key} className="cat-card" onClick={handleRequestService} style={{ animationDelay: `${i * 0.08}s` }}>
                <div style={{ marginBottom: 16, color: "#10b981" }}>{cat.icon}</div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 18, marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  {cat.name}
                  <span className="cat-arrow"><IconArrow /></span>
                </div>
                <div style={{ fontSize: 14, color: "#888", lineHeight: 1.5 }}>{cat.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="divider" style={{ maxWidth: 1200, margin: "0 auto" }} />

      {/* ═══ HOW IT WORKS ═══ */}
      <section id="how" style={{ padding: "80px 0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
          <h2 className="section-title" style={{ fontFamily: "'Syne', sans-serif", fontSize: 40, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 56 }}>
            {t.how.title}
          </h2>
          <div className="steps-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32 }}>
            {[
              { num: "1", title: t.how.s1t, desc: t.how.s1d },
              { num: "2", title: t.how.s2t, desc: t.how.s2d },
              { num: "3", title: t.how.s3t, desc: t.how.s3d },
            ].map((step) => (
              <div key={step.num} style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
                <div className="step-num">{step.num}</div>
                <div>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 20, marginBottom: 8 }}>{step.title}</div>
                  <div style={{ fontSize: 15, color: "#777", lineHeight: 1.6 }}>{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="divider" style={{ maxWidth: 1200, margin: "0 auto" }} />

      {/* ═══ WHY SERVI ═══ */}
      <section id="about" style={{ padding: "80px 0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
          <div className="about-layout" style={{ display: "flex", gap: 64, alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <h2 className="section-title" style={{ fontFamily: "'Syne', sans-serif", fontSize: 40, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 24 }}>
                {t.about.title}
              </h2>
              <p style={{ fontSize: 17, color: "#666", lineHeight: 1.7, marginBottom: 16 }}>{t.about.sub}</p>
              <p style={{ fontSize: 17, fontWeight: 600, color: "#0a0a0a", lineHeight: 1.7 }}>{t.about.bold}</p>
            </div>
            <div className="stats-grid" style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
              {t.about.stats.map((s, i) => (
                <div key={i} className="stat-item">
                  <div className="stat-num">{s.num}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="divider" style={{ maxWidth: 1200, margin: "0 auto" }} />

      {/* ═══ TESTIMONIALS ═══ */}
      <section id="testimonials" style={{ padding: "80px 0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
          <h2 className="section-title" style={{ fontFamily: "'Syne', sans-serif", fontSize: 40, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 48 }}>
            {t.testimonials.title}
          </h2>
          <div className="test-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
            {t.testimonials.items.map((item, i) => (
              <div key={i} className="testimonial-card">
                <div style={{ fontSize: 32, color: "#10b981", fontFamily: "Georgia, serif", lineHeight: 1, marginBottom: 16 }}>"</div>
                <p style={{ fontSize: 15, color: "#555", lineHeight: 1.7, marginBottom: 20 }}>{item.text}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 600 }}>
                    {item.author.charAt(0)}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{item.author}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PROVIDERS ═══ */}
      <section id="providers" style={{ padding: "40px 0 80px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="provider-section">
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 36, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 16 }}>
              {t.providers.title}
            </h2>
            <p style={{ fontSize: 17, color: "rgba(255,255,255,0.7)", marginBottom: 36, maxWidth: 480, lineHeight: 1.6 }}>
              {t.providers.sub}
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button style={{ background: "#fff", color: "#0a0a0a", border: "none", padding: "16px 28px", borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans'", transition: "all 0.25s" }}>
                {t.providers.cta1}
              </button>
              <button style={{ background: "transparent", color: "#fff", border: "1.5px solid rgba(255,255,255,0.3)", padding: "16px 28px", borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans'", transition: "all 0.25s" }}>
                {t.providers.cta2}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ CONTACT ═══ */}
      <section id="contact" style={{ padding: "0 0 80px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
          <h2 className="section-title" style={{ fontFamily: "'Syne', sans-serif", fontSize: 40, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 32 }}>
            {t.contact.title}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, color: "#555", fontSize: 15 }}>
              <IconPin /> {t.contact.address}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, color: "#555", fontSize: 15 }}>
              <IconMail /> {t.contact.email}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, color: "#555", fontSize: 15 }}>
              <span style={{ color: "#25D366" }}><IconWhatsApp /></span> WhatsApp
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer style={{ borderTop: "1px solid #eee", padding: "48px 0 32px", background: "#fff" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 32, marginBottom: 40 }}>
            <div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22, marginBottom: 20 }}>SERVI<span style={{ color: "#10b981" }}>.</span></div>
              <div style={{ fontSize: 13, color: "#888", lineHeight: 1.6 }}>{t.contact.address}</div>
            </div>
            {[
              { title: t.footer.servi, links: [t.footer.links.solicita, t.footer.links.whatWeOffer, t.footer.links.how, t.footer.links.app, t.footer.links.testimonials] },
              { title: t.footer.partners, links: [t.footer.links.bePartner, t.footer.links.whatIsPartner, t.footer.links.howPartner, t.footer.links.handbook] },
              { title: t.footer.help, links: [t.footer.links.report, t.footer.links.whoWeAre, t.footer.links.contactUs] },
              { title: t.footer.legal, links: [t.footer.links.terms, t.footer.links.privacy, t.footer.links.cancellation, t.footer.links.legal] },
            ].map((col) => (
              <div key={col.title}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, color: "#0a0a0a" }}>{col.title}</div>
                {col.links.map((link) => (
                  <div key={link} style={{ fontSize: 13, color: "#888", marginBottom: 10, cursor: "pointer", transition: "color 0.2s" }}
                    onMouseEnter={e => e.target.style.color = "#0a0a0a"} onMouseLeave={e => e.target.style.color = "#888"}>
                    {link}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ borderTop: "1px solid #eee", paddingTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div style={{ fontSize: 12, color: "#aaa" }}>© 2026 SERVI. All rights reserved.</div>
          </div>
        </div>
      </footer>

      {/* ═══ AUTH MODAL ═══ */}
      {showAuth && (
        <AuthModal
          t={t}
          mode={authMode}
          onSwitch={() => setAuthMode(authMode === "login" ? "signup" : "login")}
          onClose={() => setShowAuth(false)}
          onSuccess={handleAuthSuccess}
        />
      )}

      {/* ═══ BOOKING PANEL ═══ */}
      {showBooking && (
        <BookingPanel
          t={t}
          lang={lang}
          user={user}
          onClose={() => setShowBooking(false)}
          onLogin={() => { setShowBooking(false); setShowAuth(true); setAuthMode("login"); }}
        />
      )}
    </div>
  );
}

// ─── Auth Modal ─────────────────────────────────────────
function AuthModal({ t, mode, onSwitch, onClose, onSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const handleSubmit = () => {
    if (mode === "login" && email && password) {
      onSuccess({ name: email.split("@")[0], email });
    } else if (mode === "signup" && email && password && name) {
      onSuccess({ name, email });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div style={{ padding: "32px 32px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 24 }}>
              {mode === "login" ? t.auth.loginTitle : t.auth.signupTitle}
            </h2>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}><IconX /></button>
          </div>
        </div>

        <div style={{ padding: "0 32px 32px" }}>
          {/* Social login */}
          <button style={{ width: "100%", padding: "14px", border: "1.5px solid #e0e0e0", borderRadius: 12, background: "#fff", fontSize: 15, fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans'", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            {t.auth.google}
          </button>
          <button style={{ width: "100%", padding: "14px", border: "1.5px solid #e0e0e0", borderRadius: 12, background: "#0a0a0a", color: "#fff", fontSize: 15, fontWeight: 500, cursor: "pointer", fontFamily: "'DM Sans'", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.32 2.32-1.55 4.16-3.74 4.25z"/></svg>
            {t.auth.apple}
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
            <div style={{ flex: 1, height: 1, background: "#eee" }} />
            <span style={{ fontSize: 13, color: "#aaa" }}>{t.auth.or}</span>
            <div style={{ flex: 1, height: 1, background: "#eee" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {mode === "signup" && (
              <>
                <input className="input-field" placeholder={t.auth.name} value={name} onChange={e => setName(e.target.value)} />
                <input className="input-field" placeholder={t.auth.phone} value={phone} onChange={e => setPhone(e.target.value)} />
              </>
            )}
            <input className="input-field" type="email" placeholder={t.auth.email} value={email} onChange={e => setEmail(e.target.value)} />
            <input className="input-field" type="password" placeholder={t.auth.password} value={password} onChange={e => setPassword(e.target.value)} />
            <button className="btn-primary" onClick={handleSubmit} style={{ width: "100%", justifyContent: "center", marginTop: 8 }}>
              {mode === "login" ? t.auth.loginBtn : t.auth.signupBtn}
            </button>
          </div>

          <div style={{ textAlign: "center", marginTop: 20 }}>
            <button onClick={onSwitch} style={{ background: "none", border: "none", fontSize: 14, color: "#10b981", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans'" }}>
              {mode === "login" ? t.auth.switchToSignup : t.auth.switchToLogin}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Booking Panel (Full-screen on-demand interface) ────
function BookingPanel({ t, lang, user, onClose, onLogin }) {
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState(null);
  const [description, setDescription] = useState("");
  const [whenType, setWhenType] = useState("asap");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [address, setAddress] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const cats = [
    { key: "cleaning", icon: <IconCleaning />, name: lang === "es" ? "Limpieza" : "Cleaning", desc: lang === "es" ? "Hogar, oficina, jardín" : "Home, office, garden" },
    { key: "repair", icon: <IconRepair />, name: lang === "es" ? "Reparación y Mantenimiento" : "Repair & Maintenance", desc: lang === "es" ? "Plomería, electricidad, técnicos" : "Plumbing, electrical, technicians" },
    { key: "wellness", icon: <IconWellness />, name: lang === "es" ? "Bienestar y Cuidado Personal" : "Wellness & Personal Care", desc: lang === "es" ? "Servicios de cuidado personal" : "Personal care services" },
    { key: "supply", icon: <IconSupply />, name: lang === "es" ? "Abastecimiento y Compras" : "Supply & Shopping", desc: lang === "es" ? "Entregas, compras, mandados" : "Deliveries, shopping, errands" },
    { key: "maintenance", icon: <IconMaintenance />, name: lang === "es" ? "Mantenimiento" : "Maintenance", desc: lang === "es" ? "Preventivo e instalaciones" : "Preventive & installations" },
    { key: "custom", icon: <IconCustom />, name: lang === "es" ? "Personalizado" : "Custom", desc: lang === "es" ? "Descríbelo y te lo buscamos" : "Describe it, we'll find it" },
  ];

  if (!user) {
    return (
      <div className="booking-panel" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: 40 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 700, marginBottom: 12 }}>{t.booking.loginRequired}</h2>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24 }}>
            <button className="btn-primary" onClick={onLogin}>{t.booking.loginBtn}</button>
            <button className="btn-secondary" onClick={onClose}>{t.booking.back}</button>
          </div>
        </div>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="booking-panel" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: 40, animation: "fadeUp 0.5s ease" }}>
          <div style={{ color: "#10b981", marginBottom: 24 }}><IconCheck /></div>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 700, marginBottom: 12 }}>{t.booking.confirmed}</h2>
          <p style={{ color: "#777", fontSize: 16, marginBottom: 32, maxWidth: 360 }}>{t.booking.confirmedSub}</p>
          <button className="btn-primary" onClick={onClose}>{t.booking.done}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="booking-panel">
      {/* Header */}
      <div style={{ position: "sticky", top: 0, background: "rgba(250,250,250,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid #eee", zIndex: 10, padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {step > 1 && (
            <button onClick={() => setStep(step - 1)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}><IconBack /></button>
          )}
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 700 }}>{t.booking.title}</h2>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><IconX /></button>
      </div>

      {/* Progress */}
      <div style={{ padding: "0 24px", maxWidth: 640, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 4, padding: "20px 0" }}>
          {[1, 2, 3].map(s => (
            <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: s <= step ? "#0a0a0a" : "#e0e0e0", transition: "background 0.3s" }} />
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 24px 40px" }}>
        {/* Step 1: Category */}
        {step === 1 && (
          <div style={{ animation: "fadeUp 0.4s ease" }}>
            <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 24 }}>{t.booking.selectCategory}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {cats.map(cat => (
                <div key={cat.key} className={`booking-cat ${category === cat.key ? "booking-cat-active" : ""}`} onClick={() => { setCategory(cat.key); setStep(2); }}>
                  <div style={{ color: "#10b981", flexShrink: 0 }}>{cat.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{cat.name}</div>
                    <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>{cat.desc}</div>
                  </div>
                  <IconArrow />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Description + When */}
        {step === 2 && (
          <div style={{ animation: "fadeUp 0.4s ease" }}>
            <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 24 }}>{t.booking.describeNeed}</h3>
            <textarea className="input-field" placeholder={t.booking.descPlaceholder} value={description} onChange={e => setDescription(e.target.value)} style={{ marginBottom: 32 }} />

            <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 16 }}>{t.booking.when}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
              <div className={`radio-option ${whenType === "asap" ? "radio-selected" : ""}`} onClick={() => setWhenType("asap")}>
                <div className="radio-dot" />
                <span style={{ fontWeight: 500, fontSize: 15 }}>{t.booking.asap}</span>
              </div>
              <div className={`radio-option ${whenType === "schedule" ? "radio-selected" : ""}`} onClick={() => setWhenType("schedule")}>
                <div className="radio-dot" />
                <span style={{ fontWeight: 500, fontSize: 15 }}>{t.booking.schedule}</span>
              </div>
            </div>

            {whenType === "schedule" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 6, display: "block" }}>{t.booking.date}</label>
                  <input className="input-field" type="date" value={date} onChange={e => setDate(e.target.value)} />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 6, display: "block" }}>{t.booking.time}</label>
                  <input className="input-field" type="time" value={time} onChange={e => setTime(e.target.value)} />
                </div>
              </div>
            )}

            <button className="btn-primary" onClick={() => setStep(3)} style={{ width: "100%", justifyContent: "center" }}>
              {lang === "es" ? "Continuar" : "Continue"} <IconArrow />
            </button>
          </div>
        )}

        {/* Step 3: Address + Confirm */}
        {step === 3 && (
          <div style={{ animation: "fadeUp 0.4s ease" }}>
            <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 24 }}>{t.booking.where}</h3>
            <input className="input-field" placeholder={t.booking.addressPlaceholder} value={address} onChange={e => setAddress(e.target.value)} style={{ marginBottom: 32 }} />

            {/* Summary */}
            <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 16, padding: 24, marginBottom: 24 }}>
              <div style={{ fontSize: 13, color: "#aaa", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 16 }}>
                {lang === "es" ? "Resumen" : "Summary"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <span style={{ color: "#888" }}>{lang === "es" ? "Servicio" : "Service"}</span>
                  <span style={{ fontWeight: 600 }}>{cats.find(c => c.key === category)?.name}</span>
                </div>
                {description && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, gap: 24 }}>
                    <span style={{ color: "#888", flexShrink: 0 }}>{lang === "es" ? "Detalle" : "Details"}</span>
                    <span style={{ fontWeight: 500, textAlign: "right", color: "#555" }}>{description.slice(0, 60)}{description.length > 60 ? "..." : ""}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <span style={{ color: "#888" }}>{lang === "es" ? "Cuándo" : "When"}</span>
                  <span style={{ fontWeight: 600 }}>{whenType === "asap" ? t.booking.asap : `${date} ${time}`}</span>
                </div>
                {address && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, gap: 24 }}>
                    <span style={{ color: "#888", flexShrink: 0 }}>{lang === "es" ? "Dirección" : "Address"}</span>
                    <span style={{ fontWeight: 500, textAlign: "right", color: "#555" }}>{address}</span>
                  </div>
                )}
              </div>
            </div>

            <button className="btn-primary" onClick={() => setConfirmed(true)} style={{ width: "100%", justifyContent: "center", background: "#10b981", padding: "18px 32px", fontSize: 16 }}>
              {t.booking.confirm} <IconArrow />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}