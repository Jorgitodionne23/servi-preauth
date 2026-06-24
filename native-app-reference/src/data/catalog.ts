/**
 * SERVI service catalog — bilingual, ported from the live web app.
 *
 * Source of truth:
 *   - labels + example services: `frontend/shared/browse-data.js` (es/en arrays)
 *   - keywords + follow-up questions: `frontend/smart-request/catalog.js`
 *
 * 6 categories (5 service categories + a custom catch-all), 29 subcategories,
 * ~139 example services. This powers Browse, the Home category shortcuts, and
 * the mocked Smart Request matcher in `src/data/matcher.ts`.
 */
import type { Bilingual, Category, Followup } from './types';

const B = (es: string, en: string): Bilingual => ({ es, en });

/** Follow-up helper: key, question(es/en), optional chips as [es,en] tuples. */
const fu = (
  key: string,
  qEs: string,
  qEn: string,
  chips?: [string, string][],
): Followup => ({
  key,
  q: B(qEs, qEn),
  chips: chips?.map(([es, en]) => B(es, en)),
});

const GENERIC_FU: Followup[] = [
  fu('notes', '¿Algo que debamos saber de antemano?', 'Anything we should know up front?'),
];

export const catalog: Category[] = [
  {
    key: 'cleaning',
    label: B('Limpieza', 'Cleaning'),
    icon: 'wind',
    blurb: B('Hogar, oficina y jardín', 'Home, office & garden'),
    subs: [
      {
        key: 'home-cleaning',
        label: B('Limpieza del hogar', 'Home cleaning'),
        icon: 'home',
        services: {
          es: ['Limpieza semanal de departamento', 'Limpieza de cocina y estufa', 'Limpieza completa de baños', 'Sacudir y aspirar sala y recámaras', 'Limpieza antes de recibir visitas'],
          en: ['Weekly apartment cleaning', 'Kitchen and stove cleaning', 'Full bathroom cleaning', 'Dusting and vacuuming bedrooms and living room', 'Pre-guest home refresh'],
        },
        keywords: ['clean', 'cleaning', 'limpieza', 'limpiar', 'aseo', 'apartment', 'departamento', 'kitchen', 'cocina', 'bathroom', 'baño', 'vacuum', 'aspirar', 'house', 'casa', 'maid'],
        followups: [
          fu('size', '¿Qué tan grande es el espacio?', 'How big is the space?', [['Estudio', 'Studio'], ['1–2 recámaras', '1–2 bedrooms'], ['3+ recámaras', '3+ bedrooms']]),
          fu('areas', '¿Qué áreas necesitan más atención?', 'Which areas need the most attention?', [['Cocina', 'Kitchen'], ['Baños', 'Bathrooms'], ['Todo', 'Whole place']]),
        ],
      },
      {
        key: 'deep-cleaning',
        label: B('Limpieza profunda', 'Deep cleaning'),
        icon: 'droplet',
        services: {
          es: ['Limpieza profunda post fiesta', 'Limpieza interior de horno y refrigerador', 'Desincrustado de sarro en baños', 'Limpieza de closets y alacenas', 'Limpieza estacional de toda la casa'],
          en: ['Post-party deep cleaning', 'Oven and refrigerator interior cleaning', 'Bathroom grout and scale removal', 'Closet and pantry deep clean', 'Seasonal whole-home deep cleaning'],
        },
        keywords: ['deep', 'profunda', 'a fondo', 'scrub', 'sarro', 'moho', 'oven', 'horno', 'fridge', 'refrigerador', 'pantry', 'alacena', 'move out', 'mudanza'],
        followups: [
          fu('reason', '¿Qué motivó la limpieza profunda?', 'What triggered the deep clean?', [['Mudanza', 'Move in / out'], ['Después de un evento', 'After an event'], ['Reset estacional', 'Seasonal reset']]),
          fu('size', '¿Cuántas recámaras aprox.?', 'Roughly how many bedrooms?', [['1', '1'], ['2', '2'], ['3+', '3+']]),
        ],
      },
      {
        key: 'dry-cleaning',
        label: B('Tintorería', 'Dry cleaning'),
        icon: 'wind',
        services: {
          es: ['Tintorería para trajes y sacos', 'Quitado de manchas en vestidos', 'Lavado de edredones y cobijas', 'Limpieza de cortinas y blancos', 'Recolección y entrega de prendas en la semana'],
          en: ['Dry cleaning for suits and blazers', 'Dress stain removal', 'Blanket and comforter cleaning', 'Curtain and linen cleaning', 'Weekday garment pickup and delivery'],
        },
        keywords: ['dry clean', 'tintoreria', 'lavanderia', 'laundry', 'suit', 'traje', 'dress', 'vestido', 'stain', 'mancha', 'comforter', 'edredon', 'curtain', 'cortina'],
        followups: [
          fu('items', '¿Qué necesita limpieza?', 'What needs cleaning?', [['Trajes', 'Suits'], ['Vestidos', 'Dresses'], ['Blancos', 'Bedding']]),
          fu('pickup', '¿Necesitas recolección y entrega?', 'Need pickup & delivery?', [['Sí', 'Yes'], ['Yo lo llevo', "I'll drop off"]]),
        ],
      },
    ],
  },
  {
    key: 'repair',
    label: B('Reparación y mantenimiento', 'Repair & Maintenance'),
    icon: 'tool',
    blurb: B('Plomería, electricidad y más', 'Plumbing, electrical & more'),
    subs: [
      {
        key: 'gardening',
        label: B('Jardinería', 'Gardening'),
        icon: 'sun',
        services: {
          es: ['Corte de pasto', 'Mantenimiento general de jardín', 'Poda de arbustos y setos', 'Revisión de sistema de riego', 'Retiro de hojas y limpieza exterior'],
          en: ['Lawn mowing', 'General garden maintenance', 'Shrub and hedge trimming', 'Irrigation system check', 'Leaf removal and outdoor cleanup'],
        },
        keywords: ['lawn', 'pasto', 'mow', 'garden', 'jardin', 'hedge', 'poda', 'riego', 'irrigation', 'yard', 'plants', 'plantas'],
        followups: GENERIC_FU,
      },
      {
        key: 'plumbing',
        label: B('Plomería', 'Plumbing'),
        icon: 'droplet',
        services: {
          es: ['Destape de lavabo o fregadero', 'Reparación de fuga en WC', 'Cambio de llave o mezcladora', 'Diagnóstico de boiler o calentador', 'Reparación de fuga en tubería', 'Reparación de baja presión de agua'],
          en: ['Sink or drain unclogging', 'Toilet leak repair', 'Faucet or mixer replacement', 'Water heater diagnosis', 'Pipe leak repair', 'Low water pressure repair'],
        },
        keywords: ['plumb', 'plomero', 'plomeria', 'sink', 'lavabo', 'drain', 'drenaje', 'clog', 'tapado', 'toilet', 'wc', 'leak', 'fuga', 'faucet', 'llave', 'pipe', 'tuberia', 'water', 'agua', 'boiler', 'calentador', 'flood', 'inundacion'],
        followups: [
          fu('fixture', '¿Qué accesorio está afectado?', 'Which fixture is affected?', [['Lavabo', 'Sink'], ['WC', 'Toilet'], ['Regadera', 'Shower'], ['Tubería', 'Pipes']]),
          fu('severity', '¿Hay fuga de agua ahora mismo?', 'Is water leaking right now?', [['Sí, activa', 'Yes, actively'], ['Un poco', 'A little'], ['No', 'No']]),
        ],
      },
      {
        key: 'electrical',
        label: B('Electricidad', 'Electrical'),
        icon: 'zap',
        services: {
          es: ['Instalación de lámparas o luminarias', 'Cambio de apagadores y contactos', 'Diagnóstico de corto o breaker disparado', 'Instalación de ventilador de techo', 'Revisión de cableado interior'],
          en: ['Light fixture installation', 'Outlet and switch replacement', 'Short circuit or breaker troubleshooting', 'Ceiling fan installation', 'Interior wiring inspection'],
        },
        keywords: ['electric', 'electricista', 'luz', 'light', 'lampara', 'outlet', 'contacto', 'switch', 'apagador', 'breaker', 'corto', 'short', 'fan', 'ventilador', 'wiring', 'cableado', 'power', 'spark', 'chispa'],
        followups: [
          fu('issue', '¿Cuál es el problema?', "What's the issue?", [['Sin luz', 'No power'], ['Instalar luminaria', 'Install fixture'], ['Contacto / apagador', 'Outlet / switch'], ['Se bota el breaker', 'Breaker tripping']]),
          fu('count', '¿Cuántos puntos están afectados?', 'How many points are affected?', [['Uno', 'One'], ['Varios', 'A few'], ['Toda la casa', 'Whole home']]),
        ],
      },
      {
        key: 'carpentry',
        label: B('Carpintería', 'Carpentry'),
        icon: 'tool',
        services: {
          es: ['Instalación de repisas a medida', 'Reparación de puertas de clóset o gabinete', 'Ajuste de puertas interiores', 'Reparación de muebles de madera', 'Colocación de zoclos y molduras'],
          en: ['Custom shelf installation', 'Closet or cabinet door repair', 'Interior door alignment', 'Wood furniture repair', 'Baseboard and trim installation'],
        },
        keywords: ['carpenter', 'carpintero', 'wood', 'madera', 'shelf', 'repisa', 'cabinet', 'gabinete', 'closet', 'door', 'puerta', 'furniture', 'mueble', 'baseboard', 'zoclo'],
        followups: [
          fu('object', '¿Qué necesita trabajo?', 'What needs work?', [['Puerta', 'Door'], ['Repisa / gabinete', 'Shelf / cabinet'], ['Mueble', 'Furniture']]),
        ],
      },
      {
        key: 'locksmith',
        label: B('Cerrajería', 'Locksmith'),
        icon: 'key',
        services: {
          es: ['Apertura de puerta por olvido de llaves', 'Apertura de auto por olvido de llaves', 'Duplicado de llaves', 'Instalación de cerradura inteligente', 'Ajuste de cerradura que se atora'],
          en: ['Emergency home lockout', 'Car lockouts', 'Key duplication', 'Smart lock installation', 'Stuck lock adjustment'],
        },
        keywords: ['lock', 'cerradura', 'locksmith', 'cerrajero', 'lockout', 'encerrado', 'key', 'llave', 'chapa', 'deadbolt', 'smart lock'],
        followups: [
          fu('need', '¿Qué necesitas?', 'What do you need?', [['Estoy encerrado', 'Locked out now'], ['Cerradura nueva', 'New lock'], ['Copia de llave', 'Key copy']]),
          fu('urgent', '¿Es urgente?', 'Is this urgent?', [['Sí, estoy atorado', "Yes, I'm stuck"], ['Sin prisa', 'No rush']]),
        ],
      },
      {
        key: 'handyman',
        label: B('Handyman', 'Handyman'),
        icon: 'tool',
        services: {
          es: ['Montaje de TV en muro', 'Resane de hoyos y grietas pequeñas', 'Instalación de cortineros o persianas', 'Sellado de silicon en cocina o baño', 'Colgado de cuadros, espejos o accesorios'],
          en: ['TV wall mounting', 'Small wall patching and repairs', 'Curtain rod or blind installation', 'Kitchen or bathroom caulking', 'Hanging mirrors, frames, or accessories'],
        },
        keywords: ['handyman', 'todologo', 'mount', 'montar', 'tv', 'wall', 'pared', 'patch', 'resanar', 'curtain rod', 'cortinero', 'blind', 'persiana', 'caulk', 'silicon', 'hang', 'colgar', 'mirror', 'espejo'],
        followups: [
          fu('task', '¿Cuál es la tarea?', "What's the task?", [['Montar / colgar algo', 'Mount / hang something'], ['Resanar una pared', 'Patch a wall'], ['Instalar accesorio', 'Install a fixture'], ['Otro', 'Other']]),
        ],
      },
      {
        key: 'assembly-installation',
        label: B('Montaje e instalación', 'Assembly & installation'),
        icon: 'package',
        services: {
          es: ['Armado de cama o base', 'Ensamble de escritorio o librero', 'Instalación de estantería modular', 'Conexión de lavadora o secadora', 'Instalación de muebles listos para armar'],
          en: ['Bed frame assembly', 'Desk or bookcase assembly', 'Modular shelving installation', 'Washer or dryer hookup', 'Flat-pack furniture installation'],
        },
        keywords: ['assembly', 'armar', 'assemble', 'ensamblar', 'install', 'instalar', 'bed frame', 'cama', 'desk', 'escritorio', 'bookcase', 'librero', 'washer', 'lavadora', 'ikea', 'flat pack'],
        followups: [
          fu('item', '¿Qué vamos a armar?', 'What are we assembling?', [['Cama', 'Bed'], ['Escritorio / repisa', 'Desk / shelf'], ['Electrodoméstico', 'Appliance'], ['Otro', 'Other']]),
        ],
      },
      {
        key: 'tailoring',
        label: B('Sastrería', 'Tailoring'),
        icon: 'scissors',
        services: {
          es: ['Dobladillo de pantalones', 'Ajuste de vestido o falda', 'Cambio de cierre', 'Ajuste de saco o traje', 'Modificación de cortinas o manteles'],
          en: ['Pant hemming', 'Dress or skirt alterations', 'Zipper replacement', 'Blazer or suit tailoring', 'Curtain or tablecloth alterations'],
        },
        keywords: ['tailor', 'sastre', 'sew', 'coser', 'hem', 'dobladillo', 'alteration', 'ajuste', 'zipper', 'cierre', 'stitch'],
        followups: [
          fu('work', '¿Qué tipo de trabajo?', 'What kind of work?', [['Dobladillo', 'Hemming'], ['Ajustes', 'Alterations'], ['Cierre / reparación', 'Zipper / repair']]),
        ],
      },
    ],
  },
  {
    key: 'moving',
    label: B('Mudanzas y transporte', 'Move & Transport'),
    icon: 'truck',
    blurb: B('Mudanzas, mandados y entregas', 'Moving, errands & deliveries'),
    subs: [
      {
        key: 'moving',
        label: B('Mudanzas', 'Moving'),
        icon: 'truck',
        services: {
          es: ['Mudanza de departamento dentro de la ciudad', 'Ayuda para empacar cajas', 'Carga y descarga de camioneta', 'Apoyo para instalarse en nuevo hogar'],
          en: ['In-city apartment move', 'Packing help for moving boxes', 'Truck loading and unloading', 'Move-in setup assistance'],
        },
        keywords: ['move', 'moving', 'mudanza', 'mover', 'relocate', 'packing', 'empacar', 'boxes', 'cajas', 'truck', 'camioneta', 'load', 'cargar'],
        followups: [
          fu('size', '¿Qué tan grande es la mudanza?', 'How big is the move?', [['Pocas cosas', 'A few items'], ['Estudio / 1 rec', 'Studio / 1BR'], ['2 rec+', '2BR+']]),
          fu('packing', '¿Necesitas ayuda para empacar?', 'Do you need packing help?', [['Sí', 'Yes'], ['Solo mover', 'Just moving']]),
        ],
      },
      {
        key: 'large-items',
        label: B('Objetos grandes', 'Large items'),
        icon: 'box',
        services: {
          es: ['Transporte de sofá o sala', 'Movimiento de colchón y base', 'Traslado de refrigerador o lavadora', 'Entrega de comedor o mesa grande'],
          en: ['Sofa transport', 'Mattress and bed base moving', 'Refrigerator or washer relocation', 'Large dining table delivery'],
        },
        keywords: ['sofa', 'couch', 'mattress', 'colchon', 'fridge', 'refrigerador', 'washer', 'lavadora', 'dining table', 'comedor', 'heavy', 'pesado', 'large item'],
        followups: [
          fu('item', '¿Qué se va a mover?', "What's being moved?", [['Sofá', 'Sofa'], ['Colchón', 'Mattress'], ['Electrodoméstico', 'Appliance'], ['Otro', 'Other']]),
          fu('access', '¿Hay escaleras o elevador?', 'Any stairs or elevator?', [['Elevador', 'Elevator'], ['Escaleras', 'Stairs'], ['Planta baja', 'Ground floor']]),
        ],
      },
      {
        key: 'errands',
        label: B('Mandados', 'Errands'),
        icon: 'shopping-bag',
        services: {
          es: ['Compra de súper urgente', 'Recoger medicinas en farmacia', 'Entrega de documentos o llaves', 'Devoluciones y cambios en tiendas'],
          en: ['Urgent grocery run', 'Pharmacy pickup', 'Document or key drop-off', 'Store returns and exchanges'],
        },
        keywords: ['errand', 'mandado', 'grocery', 'super', 'despensa', 'pharmacy', 'farmacia', 'pickup', 'recoger', 'drop off', 'return', 'devolucion'],
        followups: [
          fu('errand', '¿Cuál es el mandado?', "What's the errand?", [['Súper', 'Groceries'], ['Farmacia', 'Pharmacy'], ['Recoger / entregar', 'Pickup / drop-off']]),
        ],
      },
      {
        key: 'deliveries',
        label: B('Entregas', 'Deliveries'),
        icon: 'package',
        services: {
          es: ['Entrega exprés el mismo día', 'Entrega de compra grande de tienda', 'Entrega de charolas o catering', 'Entrega de flores o regalos', 'Ruta programada de entregas recurrentes'],
          en: ['Same-day express delivery', 'Large store purchase delivery', 'Catering tray delivery', 'Flower or gift delivery', 'Scheduled recurring delivery route'],
        },
        keywords: ['delivery', 'entrega', 'deliver', 'courier', 'mensajeria', 'parcel', 'paquete', 'flowers', 'flores', 'gift', 'regalo', 'same day', 'mismo dia'],
        followups: [
          fu('item', '¿Qué vamos a entregar?', 'What are we delivering?', [['Un paquete', 'A package'], ['Comida / catering', 'Food / catering'], ['Flores / regalo', 'Flowers / gift']]),
        ],
      },
    ],
  },
  {
    key: 'wellness',
    label: B('Bienestar y cuidado', 'Wellness & Personal Care'),
    icon: 'heart',
    blurb: B('Cuidado personal a domicilio', 'Personal care at home'),
    subs: [
      {
        key: 'massage',
        label: B('Masaje', 'Massage'),
        icon: 'heart',
        services: {
          es: ['Masaje relajante a domicilio', 'Masaje descontracturante de espalda', 'Masaje para dos personas', 'Masaje de recuperación muscular', 'Sesión de masaje después de viaje o estrés'],
          en: ['In-home relaxation massage', 'Deep-tension back massage', 'Couples massage session', 'Muscle recovery massage', 'Post-travel or stress relief massage'],
        },
        keywords: ['massage', 'masaje', 'relax', 'relajante', 'back', 'espalda', 'tension', 'spa', 'muscle', 'muscular'],
        followups: [
          fu('type', '¿Qué tipo de masaje?', 'What type of massage?', [['Relajante', 'Relaxation'], ['Descontracturante', 'Deep tension'], ['Recuperación', 'Recovery']]),
          fu('people', '¿Para cuántas personas?', 'For how many people?', [['Solo yo', 'Just me'], ['Dos', 'Two']]),
        ],
      },
      {
        key: 'therapist',
        label: B('Terapeuta', 'Therapist'),
        icon: 'message-circle',
        services: {
          es: ['Sesión de terapia individual en línea', 'Acompañamiento por ansiedad o estrés', 'Terapia de pareja', 'Apoyo en duelo o transición personal', 'Sesión inicial para adolescente'],
          en: ['Online individual therapy session', 'Stress and anxiety counseling', 'Couples therapy', 'Grief or life-transition support', 'Introductory teen counseling session'],
        },
        keywords: ['therapy', 'terapia', 'therapist', 'terapeuta', 'counseling', 'psicologo', 'anxiety', 'ansiedad', 'stress', 'estres', 'mental'],
        followups: [
          fu('type', '¿Qué tipo de apoyo?', 'What kind of support?', [['Individual', 'Individual'], ['Pareja', 'Couples'], ['Adolescente', 'Teen']]),
        ],
      },
      {
        key: 'personal-trainer',
        label: B('Entrenador personal', 'Personal trainer'),
        icon: 'activity',
        services: {
          es: ['Rutina de fuerza en casa', 'Inicio de plan para bajar de peso', 'Sesión de movilidad y estiramiento', 'Entrenamiento para principiantes', 'Acondicionamiento físico de bajo impacto'],
          en: ['At-home strength workout', 'Weight-loss plan kickoff', 'Mobility and stretching session', 'Beginner fitness training', 'Low-impact conditioning workout'],
        },
        keywords: ['trainer', 'entrenador', 'workout', 'rutina', 'fitness', 'gym', 'exercise', 'ejercicio', 'strength', 'fuerza', 'weight loss', 'bajar de peso'],
        followups: [
          fu('goal', '¿Cuál es tu objetivo?', "What's your goal?", [['Fuerza', 'Strength'], ['Bajar de peso', 'Weight loss'], ['Movilidad', 'Mobility']]),
        ],
      },
      {
        key: 'pet-care',
        label: B('Cuidado de mascotas', 'Pet care'),
        icon: 'feather',
        services: {
          es: ['Paseo diario para perro', 'Pet sitting durante viaje', 'Baño y cepillado básico', 'Visita para dar alimento y agua', 'Apoyo para administrar medicamento'],
          en: ['Daily dog walking', 'Pet sitting during travel', 'Basic bath and brushing', 'Feeding and water refill visit', 'Medication support visit'],
        },
        keywords: ['pet', 'mascota', 'dog', 'perro', 'cat', 'gato', 'walk', 'pasear', 'pet sitting', 'groom', 'baño', 'feed', 'alimento'],
        followups: [
          fu('need', '¿Qué necesita tu mascota?', 'What does your pet need?', [['Paseo', 'Walking'], ['Cuidado', 'Sitting'], ['Baño', 'Grooming']]),
          fu('pet', '¿Qué tipo de mascota?', 'What kind of pet?', [['Perro', 'Dog'], ['Gato', 'Cat'], ['Otro', 'Other']]),
        ],
      },
      {
        key: 'child-care',
        label: B('Cuidado infantil', 'Child care'),
        icon: 'smile',
        services: {
          es: ['Niñera por la tarde después de escuela', 'Cuidado nocturno para salida de los papás', 'Recoger a niños y acompañarlos en casa', 'Apoyo de niñera en fin de semana', 'Cuidado para bebé por horas'],
          en: ['After-school babysitting', 'Evening babysitter for date night', 'School pickup and in-home care', 'Weekend nanny support', 'Hourly infant care'],
        },
        keywords: ['babysit', 'niñera', 'nanny', 'child', 'niños', 'kids', 'baby', 'bebe', 'infant', 'sitter'],
        followups: [
          fu('when', '¿Cuándo necesitas el cuidado?', 'When do you need care?', [['Después de escuela', 'After school'], ['Noche', 'Evening'], ['Fin de semana', 'Weekend']]),
          fu('ages', '¿Edades de los niños?', 'Ages of the kids?', [['Bebé', 'Infant'], ['Pequeño', 'Toddler'], ['Escolar', 'School-age']]),
        ],
      },
      {
        key: 'elder-assistance',
        label: B('Asistencia a mayores', 'Elder assistance'),
        icon: 'users',
        services: {
          es: ['Visita de compañía en casa', 'Recordatorio y apoyo con medicamentos', 'Acompañamiento a consulta médica', 'Ayuda ligera para preparar alimentos', 'Apoyo en caminatas y movilidad básica'],
          en: ['Companion visit at home', 'Medication reminder support', 'Medical appointment accompaniment', 'Light meal-prep assistance', 'Walking and basic mobility support'],
        },
        keywords: ['elder', 'mayor', 'senior', 'anciano', 'companion', 'compañia', 'caregiver', 'cuidador', 'mobility', 'movilidad', 'medication', 'medicamento'],
        followups: [
          fu('help', '¿Qué tipo de ayuda?', 'What kind of help?', [['Compañía', 'Companionship'], ['Citas médicas', 'Appointments'], ['Tareas diarias', 'Daily tasks']]),
        ],
      },
    ],
  },
  {
    key: 'suppliers',
    label: B('Proveedores', 'Suppliers'),
    icon: 'shopping-bag',
    blurb: B('Despensa, comida y más', 'Pantry, food & more'),
    subs: [
      {
        key: 'artisan-bread',
        label: B('Pan artesanal', 'Artisan bread'),
        icon: 'coffee',
        services: {
          es: ['Pedido de pan de masa madre', 'Caja de pan dulce y brioche', 'Pan para brunch o desayuno', 'Bollos y panecillos para cena', 'Suscripción semanal de pan'],
          en: ['Sourdough bread order', 'Brioche and pastry box', 'Brunch or breakfast bakery order', 'Dinner rolls and buns order', 'Weekly bread subscription'],
        },
        keywords: ['bread', 'pan', 'sourdough', 'masa madre', 'bakery', 'panaderia', 'pastry', 'brioche'],
        followups: GENERIC_FU,
      },
      {
        key: 'fresh-dairy',
        label: B('Lácteos frescos', 'Fresh dairy'),
        icon: 'droplet',
        services: {
          es: ['Reposición de leche y yogurt', 'Tabla de quesos artesanales', 'Pedido de mantequilla y crema', 'Entrega de lácteos sin lactosa', 'Combo lácteo para desayunos'],
          en: ['Milk and yogurt restock', 'Artisan cheese board order', 'Butter and cream delivery', 'Lactose-free dairy delivery', 'Breakfast dairy bundle'],
        },
        keywords: ['dairy', 'lacteos', 'milk', 'leche', 'yogurt', 'cheese', 'queso', 'butter', 'mantequilla', 'cream', 'crema'],
        followups: GENERIC_FU,
      },
      {
        key: 'pharmacy',
        label: B('Farmacia', 'Pharmacy'),
        icon: 'plus-circle',
        services: {
          es: ['Recoger receta el mismo día', 'Compra de medicamento sin receta', 'Reposición de botiquín básico', 'Pedido de artículos para bebé'],
          en: ['Same-day prescription pickup', 'Over-the-counter medication order', 'First-aid kit refill', 'Baby care essentials order'],
        },
        keywords: ['pharmacy', 'farmacia', 'prescription', 'receta', 'medicine', 'medicina', 'medication', 'first aid', 'botiquin'],
        followups: [
          fu('need', '¿Qué necesitas?', 'What do you need?', [['Receta', 'Prescription'], ['Sin receta', 'Over-the-counter'], ['Bebé', 'Baby care']]),
        ],
      },
      {
        key: 'catering',
        label: B('Catering', 'Catering'),
        icon: 'coffee',
        services: {
          es: ['Charolas para comida de oficina', 'Servicio de brunch para reunión', 'Bocadillos para evento o cóctel', 'Buffet familiar para celebración', 'Box lunches para equipo pequeño'],
          en: ['Office lunch trays', 'Brunch catering setup', 'Cocktail bites for events', 'Family buffet catering', 'Boxed lunches for small teams'],
        },
        keywords: ['catering', 'charolas', 'lunch tray', 'buffet', 'event food', 'coctel', 'office lunch', 'party food'],
        followups: [
          fu('occasion', '¿Cuál es la ocasión?', "What's the occasion?", [['Oficina', 'Office'], ['Fiesta', 'Party'], ['Grupo pequeño', 'Small group']]),
          fu('guests', '¿Aprox. cuántas personas?', 'Roughly how many people?', [['<10', '<10'], ['10–25', '10–25'], ['25+', '25+']]),
        ],
      },
      {
        key: 'organic-butcher',
        label: B('Carnicería orgánica', 'Organic butcher'),
        icon: 'shopping-bag',
        services: {
          es: ['Pedido de cortes para asado', 'Paquete semanal de pollo', 'Carne molida para hamburguesas', 'Cortes especiales por encargo', 'Huesos y caldo para cocina casera'],
          en: ['Steak and grill order', 'Weekly chicken pack', 'Ground meat for burgers', 'Specialty cuts by request', 'Soup bones and broth staples'],
        },
        keywords: ['butcher', 'carniceria', 'meat', 'carne', 'steak', 'beef', 'chicken', 'pollo', 'cuts', 'cortes', 'grill', 'asado'],
        followups: GENERIC_FU,
      },
      {
        key: 'fish',
        label: B('Pescadería', 'Fish'),
        icon: 'anchor',
        services: {
          es: ['Entrega de filete de salmón', 'Pedido de camarón fresco', 'Atún para sashimi o sushi', 'Paquete familiar de mariscos', 'Pescado entero limpio y listo para cocinar'],
          en: ['Salmon fillet delivery', 'Fresh shrimp order', 'Sushi-grade tuna order', 'Family seafood pack', 'Whole fish cleaned and ready to cook'],
        },
        keywords: ['fish', 'pescado', 'seafood', 'mariscos', 'salmon', 'shrimp', 'camaron', 'tuna', 'atun', 'sushi'],
        followups: GENERIC_FU,
      },
      {
        key: 'organic-vegetables',
        label: B('Vegetales orgánicos', 'Organic vegetables'),
        icon: 'shopping-bag',
        services: {
          es: ['Caja semanal de verduras orgánicas', 'Reposición de hojas y ensaladas', 'Verduras de temporada para cocinar', 'Paquete para jugos y smoothies', 'Canasta familiar de frutas y verduras'],
          en: ['Weekly organic produce box', 'Leafy greens and salad restock', 'Seasonal cooking vegetables', 'Juicing and smoothie bundle', 'Family fruit and vegetable basket'],
        },
        keywords: ['vegetable', 'verduras', 'veggies', 'produce', 'organic', 'organico', 'greens', 'salad', 'ensalada', 'fruit', 'fruta'],
        followups: GENERIC_FU,
      },
    ],
  },
  {
    key: 'custom',
    label: B('Personalizado', 'Custom'),
    icon: 'edit-3',
    blurb: B('Descríbelo y lo encontramos', "Describe it and we'll find it"),
    subs: [
      {
        key: 'custom',
        label: B('Solicitud personalizada', 'Custom request'),
        icon: 'edit-3',
        services: {
          es: ['Cuéntanos qué necesitas y lo resolvemos'],
          en: ["Tell us what you need and we'll handle it"],
        },
        keywords: [],
        followups: GENERIC_FU,
      },
    ],
  },
];

/** Flat lookup helpers. */
export const categoryByKey = Object.fromEntries(catalog.map((c) => [c.key, c]));

export function findSub(categoryKey: string, subKey: string) {
  const cat = catalog.find((c) => c.key === categoryKey);
  return cat?.subs.find((s) => s.key === subKey) ?? null;
}

export function allSubsFlat() {
  return catalog.flatMap((c) =>
    c.subs.map((s) => ({ category: c, sub: s })),
  );
}
