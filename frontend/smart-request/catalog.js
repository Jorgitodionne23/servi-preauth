/* ─────────────────────────────────────────────────────────────────────────
   SERVI catalog — compact, English-canonical mirror of browse-data.js.
   Used to GROUND the AI parse (so matches map to real services) and to power
   the heuristic fallback when no LLM is available.
   Shape per category: { emoji, label, subs: [{ key, label, services:[], kw:[] }] }
   ──────────────────────────────────────────────────────────────────────── */
window.SERVI_CATALOG = {
  cleaning: {
    emoji: '🧹', label: 'Cleaning',
    subs: [
      { key: 'home-cleaning', label: 'Home cleaning',
        services: ['Weekly apartment cleaning', 'Kitchen and stove cleaning', 'Full bathroom cleaning', 'Dusting and vacuuming bedrooms and living room', 'Pre-guest home refresh'],
        kw: ['clean', 'cleaning', 'apartment', 'kitchen', 'bathroom', 'vacuum', 'dust', 'tidy', 'house', 'home', 'maid'] },
      { key: 'deep-cleaning', label: 'Deep cleaning',
        services: ['Post-party deep cleaning', 'Oven and refrigerator interior cleaning', 'Bathroom grout and scale removal', 'Closet and pantry deep clean', 'Seasonal whole-home deep cleaning'],
        kw: ['deep', 'scrub', 'oven', 'fridge', 'refrigerator', 'grout', 'scale', 'mold', 'pantry', 'messy', 'move out', 'moveout'] },
      { key: 'dry-cleaning', label: 'Dry cleaning',
        services: ['Dry cleaning for suits and blazers', 'Dress stain removal', 'Blanket and comforter cleaning', 'Curtain and linen cleaning', 'Weekday garment pickup and delivery'],
        kw: ['dry clean', 'laundry', 'suit', 'blazer', 'dress', 'stain', 'blanket', 'comforter', 'curtain', 'garment', 'iron'] },
    ],
  },
  repair: {
    emoji: '🔧', label: 'Repair & Maintenance',
    subs: [
      { key: 'gardening', label: 'Gardening',
        services: ['Lawn mowing', 'General garden maintenance', 'Shrub and hedge trimming', 'Irrigation system check', 'Leaf removal and outdoor cleanup'],
        kw: ['lawn', 'mow', 'garden', 'hedge', 'shrub', 'grass', 'irrigation', 'sprinkler', 'leaves', 'yard', 'plants'] },
      { key: 'plumbing', label: 'Plumbing',
        services: ['Sink or drain unclogging', 'Toilet leak repair', 'Faucet or mixer replacement', 'Water heater diagnosis', 'Pipe leak repair', 'Low water pressure repair'],
        kw: ['plumb', 'plumber', 'sink', 'drain', 'clog', 'clogged', 'toilet', 'leak', 'leaking', 'faucet', 'tap', 'pipe', 'water', 'heater', 'boiler', 'flood', 'flooding', 'pressure'] },
      { key: 'electrical', label: 'Electrical',
        services: ['Light fixture installation', 'Outlet and switch replacement', 'Short circuit or breaker troubleshooting', 'Ceiling fan installation', 'Interior wiring inspection'],
        kw: ['electric', 'electrical', 'electrician', 'light', 'lamp', 'fixture', 'outlet', 'socket', 'switch', 'breaker', 'short', 'circuit', 'fan', 'wiring', 'power', 'spark'] },
      { key: 'carpentry', label: 'Carpentry',
        services: ['Custom shelf installation', 'Closet or cabinet door repair', 'Interior door alignment', 'Wood furniture repair', 'Baseboard and trim installation'],
        kw: ['carpenter', 'carpentry', 'wood', 'shelf', 'shelves', 'cabinet', 'closet', 'door', 'furniture', 'baseboard', 'trim', 'molding'] },
      { key: 'locksmith', label: 'Locksmith',
        services: ['Emergency home lockout', 'Car lockouts', 'Key duplication', 'Smart lock installation', 'Stuck lock adjustment'],
        kw: ['lock', 'locksmith', 'lockout', 'locked out', 'key', 'keys', 'smart lock', 'deadbolt'] },
      { key: 'handyman', label: 'Handyman',
        services: ['TV wall mounting', 'Small wall patching and repairs', 'Curtain rod or blind installation', 'Kitchen or bathroom caulking', 'Hanging mirrors, frames, or accessories'],
        kw: ['handyman', 'mount', 'tv', 'wall', 'patch', 'hole', 'curtain rod', 'blind', 'caulk', 'silicone', 'hang', 'mirror', 'frame', 'fix', 'odd job'] },
      { key: 'assembly-installation', label: 'Assembly & installation',
        services: ['Bed frame assembly', 'Desk or bookcase assembly', 'Modular shelving installation', 'Washer or dryer hookup', 'Flat-pack furniture installation'],
        kw: ['assembly', 'assemble', 'install', 'bed frame', 'desk', 'bookcase', 'shelving', 'washer', 'dryer', 'ikea', 'flat pack', 'flatpack', 'furniture'] },
      { key: 'tailoring', label: 'Tailoring',
        services: ['Pant hemming', 'Dress or skirt alterations', 'Zipper replacement', 'Blazer or suit tailoring', 'Curtain or tablecloth alterations'],
        kw: ['tailor', 'sew', 'sewing', 'hem', 'alteration', 'zipper', 'stitch', 'seamstress'] },
    ],
  },
  moving: {
    emoji: '📦', label: 'Move & Transport',
    subs: [
      { key: 'moving', label: 'Moving',
        services: ['In-city apartment move', 'Packing help for moving boxes', 'Truck loading and unloading', 'Move-in setup assistance'],
        kw: ['move', 'moving', 'mover', 'movers', 'relocate', 'packing', 'boxes', 'truck', 'load', 'unload', 'apartment move'] },
      { key: 'large-items', label: 'Large items',
        services: ['Sofa transport', 'Mattress and bed base moving', 'Refrigerator or washer relocation', 'Large dining table delivery'],
        kw: ['sofa', 'couch', 'mattress', 'bed', 'fridge', 'refrigerator', 'washer', 'dining table', 'heavy', 'large item', 'furniture move'] },
      { key: 'errands', label: 'Errands',
        services: ['Urgent grocery run', 'Pharmacy pickup', 'Document or key drop-off', 'Store returns and exchanges'],
        kw: ['errand', 'grocery', 'groceries', 'pharmacy', 'pickup', 'drop off', 'dropoff', 'return', 'exchange', 'pick up'] },
      { key: 'deliveries', label: 'Deliveries',
        services: ['Same-day express delivery', 'Large store purchase delivery', 'Catering tray delivery', 'Flower or gift delivery', 'Scheduled recurring delivery route'],
        kw: ['delivery', 'deliver', 'courier', 'send', 'parcel', 'package', 'flowers', 'gift', 'same day'] },
    ],
  },
  wellness: {
    emoji: '💆', label: 'Wellness & Personal Care',
    subs: [
      { key: 'massage', label: 'Massage',
        services: ['In-home relaxation massage', 'Deep-tension back massage', 'Couples massage session', 'Muscle recovery massage', 'Post-travel or stress relief massage'],
        kw: ['massage', 'masseuse', 'relax', 'back massage', 'tension', 'spa', 'muscle', 'knots'] },
      { key: 'therapist', label: 'Therapist',
        services: ['Online individual therapy session', 'Stress and anxiety counseling', 'Couples therapy', 'Grief or life-transition support', 'Introductory teen counseling session'],
        kw: ['therapy', 'therapist', 'counseling', 'counselor', 'anxiety', 'stress', 'psychologist', 'mental'] },
      { key: 'personal-trainer', label: 'Personal trainer',
        services: ['At-home strength workout', 'Weight-loss plan kickoff', 'Mobility and stretching session', 'Beginner fitness training', 'Low-impact conditioning workout'],
        kw: ['trainer', 'personal trainer', 'workout', 'fitness', 'gym', 'exercise', 'strength', 'stretch', 'weight loss'] },
      { key: 'pet-care', label: 'Pet care',
        services: ['Daily dog walking', 'Pet sitting during travel', 'Basic bath and brushing', 'Feeding and water refill visit', 'Medication support visit'],
        kw: ['pet', 'dog', 'cat', 'walk', 'walking', 'pet sitting', 'petsitting', 'groom', 'bath', 'feed', 'puppy'] },
      { key: 'child-care', label: 'Child care',
        services: ['After-school babysitting', 'Evening babysitter for date night', 'School pickup and in-home care', 'Weekend nanny support', 'Hourly infant care'],
        kw: ['babysit', 'babysitter', 'nanny', 'child', 'kids', 'childcare', 'baby', 'infant', 'sitter'] },
      { key: 'elder-assistance', label: 'Elder assistance',
        services: ['Companion visit at home', 'Medication reminder support', 'Medical appointment accompaniment', 'Light meal-prep assistance', 'Walking and basic mobility support'],
        kw: ['elder', 'elderly', 'senior', 'companion', 'caregiver', 'grandparent', 'mobility', 'medication'] },
    ],
  },
  suppliers: {
    emoji: '🛒', label: 'Suppliers',
    subs: [
      { key: 'artisan-bread', label: 'Artisan bread',
        services: ['Sourdough bread order', 'Brioche and pastry box', 'Brunch or breakfast bakery order', 'Dinner rolls and buns order', 'Weekly bread subscription'],
        kw: ['bread', 'sourdough', 'bakery', 'pastry', 'brioche', 'rolls', 'baked'] },
      { key: 'fresh-dairy', label: 'Fresh dairy',
        services: ['Milk and yogurt restock', 'Artisan cheese board order', 'Butter and cream delivery', 'Lactose-free dairy delivery', 'Breakfast dairy bundle'],
        kw: ['dairy', 'milk', 'yogurt', 'cheese', 'butter', 'cream'] },
      { key: 'pharmacy', label: 'Pharmacy',
        services: ['Same-day prescription pickup', 'Over-the-counter medication order', 'First-aid kit refill', 'Baby care essentials order'],
        kw: ['pharmacy', 'prescription', 'medicine', 'medication', 'drugstore', 'first aid'] },
      { key: 'catering', label: 'Catering',
        services: ['Office lunch trays', 'Brunch catering setup', 'Cocktail bites for events', 'Family buffet catering', 'Boxed lunches for small teams'],
        kw: ['catering', 'cater', 'lunch tray', 'buffet', 'event food', 'canapes', 'office lunch', 'party food'] },
      { key: 'organic-butcher', label: 'Organic butcher',
        services: ['Steak and grill order', 'Weekly chicken pack', 'Ground meat for burgers', 'Specialty cuts by request', 'Soup bones and broth staples'],
        kw: ['butcher', 'meat', 'steak', 'beef', 'chicken', 'pork', 'cuts', 'grill'] },
      { key: 'fish', label: 'Fish',
        services: ['Salmon fillet delivery', 'Fresh shrimp order', 'Sushi-grade tuna order', 'Family seafood pack', 'Whole fish cleaned and ready to cook'],
        kw: ['fish', 'seafood', 'salmon', 'shrimp', 'tuna', 'sushi', 'fishmonger'] },
      { key: 'organic-vegetables', label: 'Organic vegetables',
        services: ['Weekly organic produce box', 'Leafy greens and salad restock', 'Seasonal cooking vegetables', 'Juicing and smoothie bundle', 'Family fruit and vegetable basket'],
        kw: ['vegetable', 'veggies', 'produce', 'organic', 'greens', 'salad', 'fruit', 'grocery box'] },
    ],
  },
};

/* Bilingual signals for deterministic fallback matching.
   Keep labels/services English-canonical above; these terms only influence scoring. */
window.SERVI_HEURISTIC_SIGNALS = {
  'home-cleaning': {
    terms: ['limpieza', 'limpiar', 'aseo', 'casa', 'departamento', 'depa', 'cocina', 'baño', 'bano', 'recamara', 'sala', 'aspirar', 'sacudir', 'muchacha', 'personal de limpieza'],
    services: [
      { index: 0, terms: ['limpieza semanal', 'departamento', 'depa'] },
      { index: 1, terms: ['cocina', 'estufa', 'parrilla'] },
      { index: 2, terms: ['baño', 'bano', 'wc', 'regadera'] },
      { index: 3, terms: ['aspirar', 'sacudir', 'recamaras', 'sala'] },
      { index: 4, terms: ['visitas', 'invitados', 'antes de recibir'] },
    ],
    negative: ['tuberia', 'fuga', 'mudanza', 'terapia'],
  },
  'deep-cleaning': {
    terms: ['deep clean', 'deep cleaning', 'limpieza profunda', 'profunda', 'a fondo', 'desincrustar', 'sarro', 'moho', 'cochambre', 'horno', 'refrigerador', 'refri', 'closet', 'alacena', 'post fiesta', 'despues de fiesta'],
    services: [
      { index: 0, terms: ['post fiesta', 'despues de fiesta', 'evento', 'party'] },
      { index: 1, terms: ['horno', 'refrigerador', 'refri'] },
      { index: 2, terms: ['sarro', 'grout', 'juntas', 'azulejo'] },
      { index: 3, terms: ['closet', 'alacena', 'despensa'] },
      { index: 4, terms: ['toda la casa', 'estacional', 'temporada'] },
    ],
    negative: ['lavabo tapado', 'fuga', 'llaves'],
  },
  'dry-cleaning': {
    terms: ['tintoreria', 'tintorería', 'lavanderia', 'lavandería', 'ropa', 'traje', 'saco', 'vestido', 'mancha', 'edredon', 'edredón', 'cobija', 'cortina', 'planchado'],
    services: [
      { index: 0, terms: ['traje', 'saco', 'blazer'] },
      { index: 1, terms: ['vestido', 'mancha', 'desmanchar'] },
      { index: 2, terms: ['edredon', 'cobija', 'comforter'] },
      { index: 3, terms: ['cortina', 'blancos'] },
      { index: 4, terms: ['recoleccion', 'recoger ropa', 'entrega'] },
    ],
  },
  gardening: {
    terms: ['jardin', 'jardín', 'jardinero', 'pasto', 'cesped', 'césped', 'podar', 'poda', 'arbusto', 'riego', 'hojas', 'patio', 'plantas'],
    services: [
      { index: 0, terms: ['cortar pasto', 'corte de pasto', 'cesped'] },
      { index: 1, terms: ['mantenimiento jardin', 'plantas'] },
      { index: 2, terms: ['poda', 'arbustos', 'setos'] },
      { index: 3, terms: ['riego', 'aspersor', 'irrigacion'] },
      { index: 4, terms: ['hojas', 'limpieza exterior'] },
    ],
  },
  plumbing: {
    terms: ['plomero', 'plomeria', 'plomería', 'lavabo', 'fregadero', 'tarja', 'drenaje', 'destape', 'tapado', 'tapada', 'wc', 'inodoro', 'escusado', 'fuga', 'gotea', 'gotera', 'llave de agua', 'mezcladora', 'tuberia', 'tubería', 'boiler', 'calentador', 'presion de agua', 'presión de agua', 'inundacion', 'inundación'],
    services: [
      { index: 0, terms: ['lavabo tapado', 'fregadero tapado', 'tarja tapada', 'drenaje tapado', 'destape'] },
      { index: 1, terms: ['fuga wc', 'fuga inodoro', 'fuga escusado', 'toilet leak'] },
      { index: 2, terms: ['cambio de llave', 'mezcladora', 'faucet', 'tap'] },
      { index: 3, terms: ['boiler', 'calentador', 'water heater'] },
      { index: 4, terms: ['fuga tuberia', 'tuberia rota', 'pipe leak'] },
      { index: 5, terms: ['baja presion', 'presion de agua'] },
    ],
    negative: ['luz', 'lampara', 'apagador', 'enchufe', 'cerradura', 'llaves adentro'],
  },
  electrical: {
    terms: ['electricista', 'electricidad', 'electrico', 'eléctrico', 'luz', 'lampara', 'lámpara', 'luminaria', 'contacto', 'enchufe', 'apagador', 'interruptor', 'breaker', 'pastilla', 'corto', 'circuito', 'ventilador de techo', 'cableado', 'chispa'],
    services: [
      { index: 0, terms: ['instalar lampara', 'luminaria', 'foco', 'light fixture'] },
      { index: 1, terms: ['contacto', 'enchufe', 'apagador', 'switch', 'outlet'] },
      { index: 2, terms: ['corto', 'breaker', 'pastilla', 'se bota'] },
      { index: 3, terms: ['ventilador de techo', 'ceiling fan'] },
      { index: 4, terms: ['cableado', 'wiring'] },
    ],
    negative: ['fuga de agua', 'lavabo', 'tarja', 'llaves perdidas'],
  },
  carpentry: {
    terms: ['carpintero', 'carpinteria', 'carpintería', 'madera', 'repisas', 'repisa', 'closet', 'clóset', 'gabinete', 'puerta', 'mueble', 'zoclo', 'moldura'],
    services: [
      { index: 0, terms: ['repisa', 'repisas', 'estante a medida'] },
      { index: 1, terms: ['puerta closet', 'gabinete'] },
      { index: 2, terms: ['ajustar puerta', 'puerta interior'] },
      { index: 3, terms: ['mueble de madera', 'wood furniture'] },
      { index: 4, terms: ['zoclo', 'moldura', 'baseboard'] },
    ],
  },
  locksmith: {
    terms: ['cerrajero', 'cerrajeria', 'cerrajería', 'cerradura', 'chapa', 'llave', 'llaves', 'encerrado', 'encerrada', 'me quede afuera', 'me quedé afuera', 'llaves adentro', 'abrir puerta', 'duplicado', 'copia de llave'],
    services: [
      { index: 0, terms: ['llaves adentro', 'me quede afuera', 'abrir puerta', 'locked out', 'home lockout'] },
      { index: 1, terms: ['auto', 'coche', 'carro', 'car lockout'] },
      { index: 2, terms: ['duplicado', 'copia de llave', 'key copy'] },
      { index: 3, terms: ['cerradura inteligente', 'smart lock'] },
      { index: 4, terms: ['cerradura atorada', 'chapa atorada'] },
    ],
    negative: ['llave de agua', 'mezcladora', 'faucet'],
  },
  handyman: {
    terms: ['handyman', 'todologo', 'todólogo', 'montar', 'colgar', 'instalar', 'pared', 'muro', 'tele', 'television', 'televisión', 'tv', 'resanar', 'hoyo', 'grieta', 'cortinero', 'persiana', 'silicon', 'silicón', 'cuadro', 'espejo'],
    services: [
      { index: 0, terms: ['montar tv', 'tele en la pared', 'television en pared', 'tv wall'] },
      { index: 1, terms: ['resanar', 'hoyo', 'grieta', 'patch wall'] },
      { index: 2, terms: ['cortinero', 'persiana', 'curtain rod', 'blind'] },
      { index: 3, terms: ['silicon', 'silicón', 'caulk'] },
      { index: 4, terms: ['colgar cuadro', 'colgar espejo', 'marco'] },
    ],
    negative: ['cableado', 'boiler', 'mudanza'],
  },
  'assembly-installation': {
    terms: ['armar', 'ensamblar', 'ensamble', 'montaje', 'instalacion', 'instalación', 'cama', 'base de cama', 'escritorio', 'librero', 'estanteria', 'estantería', 'lavadora', 'secadora', 'ikea', 'mueble para armar'],
    services: [
      { index: 0, terms: ['armar cama', 'base de cama', 'bed frame'] },
      { index: 1, terms: ['escritorio', 'librero', 'bookcase'] },
      { index: 2, terms: ['estanteria modular', 'shelving'] },
      { index: 3, terms: ['conectar lavadora', 'secadora', 'washer', 'dryer'] },
      { index: 4, terms: ['ikea', 'flat pack', 'mueble para armar'] },
    ],
  },
  tailoring: {
    terms: ['sastre', 'sastreria', 'sastrería', 'costura', 'coser', 'dobladillo', 'bastilla', 'pantalon', 'pantalón', 'vestido', 'falda', 'cierre', 'zipper', 'ajuste de ropa'],
    services: [
      { index: 0, terms: ['dobladillo', 'bastilla', 'pantalon'] },
      { index: 1, terms: ['vestido', 'falda', 'alteracion'] },
      { index: 2, terms: ['cierre', 'zipper'] },
      { index: 3, terms: ['saco', 'traje', 'blazer'] },
      { index: 4, terms: ['cortina', 'mantel'] },
    ],
  },
  moving: {
    terms: ['mudanza', 'mudar', 'mudarnos', 'mover casa', 'cajas', 'empacar', 'camioneta', 'cargar', 'descargar', 'nuevo hogar', 'flete'],
    services: [
      { index: 0, terms: ['mudanza departamento', 'mudanza ciudad'] },
      { index: 1, terms: ['empacar', 'cajas', 'packing'] },
      { index: 2, terms: ['cargar', 'descargar', 'camioneta', 'truck'] },
      { index: 3, terms: ['instalarse', 'nuevo hogar', 'move in'] },
    ],
  },
  'large-items': {
    terms: ['objeto grande', 'mueble grande', 'sofa', 'sofá', 'sillon', 'sillón', 'colchon', 'colchón', 'base de cama', 'refrigerador', 'refri', 'lavadora', 'comedor', 'mesa grande', 'pesado'],
    services: [
      { index: 0, terms: ['sofa', 'sofá', 'sillon'] },
      { index: 1, terms: ['colchon', 'base de cama'] },
      { index: 2, terms: ['refrigerador', 'refri', 'lavadora'] },
      { index: 3, terms: ['comedor', 'mesa grande'] },
    ],
  },
  errands: {
    terms: ['mandado', 'mandados', 'super', 'súper', 'despensa', 'farmacia', 'recoger', 'llevar', 'entregar', 'documentos', 'llaves', 'devolucion', 'devolución', 'cambio en tienda'],
    services: [
      { index: 0, terms: ['super', 'súper', 'despensa', 'groceries'] },
      { index: 1, terms: ['farmacia', 'medicinas', 'pharmacy'] },
      { index: 2, terms: ['documentos', 'llaves', 'drop off'] },
      { index: 3, terms: ['devolucion', 'cambio', 'returns'] },
    ],
  },
  deliveries: {
    terms: ['entrega', 'entregar', 'envio', 'envío', 'paquete', 'mensajeria', 'mensajería', 'flores', 'regalo', 'mismo dia', 'mismo día', 'ruta'],
    services: [
      { index: 0, terms: ['express', 'mismo dia', 'same day'] },
      { index: 1, terms: ['compra grande', 'tienda'] },
      { index: 2, terms: ['catering', 'charolas', 'tray'] },
      { index: 3, terms: ['flores', 'regalo', 'gift'] },
      { index: 4, terms: ['ruta', 'recurrente'] },
    ],
  },
  massage: {
    terms: ['masaje', 'masajista', 'relajante', 'descontracturante', 'espalda', 'pareja', 'muscular', 'estres', 'estrés', 'spa'],
    services: [
      { index: 0, terms: ['relajante', 'domicilio'] },
      { index: 1, terms: ['descontracturante', 'espalda', 'tension'] },
      { index: 2, terms: ['pareja', 'dos personas'] },
      { index: 3, terms: ['recuperacion muscular', 'muscular'] },
      { index: 4, terms: ['viaje', 'estres'] },
    ],
  },
  therapist: {
    terms: ['terapia', 'terapeuta', 'psicologo', 'psicólogo', 'ansiedad', 'estres', 'estrés', 'pareja', 'duelo', 'adolescente', 'salud mental'],
    services: [
      { index: 0, terms: ['individual', 'en linea', 'online'] },
      { index: 1, terms: ['ansiedad', 'estres'] },
      { index: 2, terms: ['pareja'] },
      { index: 3, terms: ['duelo', 'transicion'] },
      { index: 4, terms: ['adolescente', 'teen'] },
    ],
  },
  'personal-trainer': {
    terms: ['entrenador', 'personal trainer', 'ejercicio', 'rutina', 'fuerza', 'bajar de peso', 'movilidad', 'estiramiento', 'fitness', 'acondicionamiento'],
    services: [
      { index: 0, terms: ['fuerza', 'casa'] },
      { index: 1, terms: ['bajar de peso', 'weight loss'] },
      { index: 2, terms: ['movilidad', 'estiramiento'] },
      { index: 3, terms: ['principiante'] },
      { index: 4, terms: ['bajo impacto'] },
    ],
  },
  'pet-care': {
    terms: ['mascota', 'perro', 'gato', 'pasear', 'paseo', 'pet sitting', 'cuidar mascota', 'baño mascota', 'cepillado', 'alimento', 'croquetas', 'medicamento mascota'],
    services: [
      { index: 0, terms: ['paseo', 'pasear perro', 'dog walking'] },
      { index: 1, terms: ['pet sitting', 'viaje', 'cuidar'] },
      { index: 2, terms: ['baño', 'cepillado', 'grooming'] },
      { index: 3, terms: ['alimento', 'agua', 'feed'] },
      { index: 4, terms: ['medicamento', 'medicina mascota'] },
    ],
  },
  'child-care': {
    terms: ['niñera', 'ninera', 'cuidado infantil', 'niños', 'ninos', 'bebé', 'bebe', 'infante', 'escuela', 'recoger niños', 'date night'],
    services: [
      { index: 0, terms: ['despues de escuela', 'after school'] },
      { index: 1, terms: ['noche', 'salida', 'date night'] },
      { index: 2, terms: ['recoger niños', 'escuela'] },
      { index: 3, terms: ['fin de semana'] },
      { index: 4, terms: ['bebe', 'infante'] },
    ],
  },
  'elder-assistance': {
    terms: ['adulto mayor', 'mayor', 'anciano', 'abuelito', 'abuelita', 'compañia', 'compañía', 'cuidador', 'medicamentos', 'consulta medica', 'movilidad'],
    services: [
      { index: 0, terms: ['compañia', 'visita'] },
      { index: 1, terms: ['recordatorio medicamento', 'medicamentos'] },
      { index: 2, terms: ['consulta medica', 'doctor'] },
      { index: 3, terms: ['preparar alimentos', 'comida'] },
      { index: 4, terms: ['caminar', 'movilidad'] },
    ],
  },
  'artisan-bread': {
    terms: ['pan', 'panaderia', 'panadería', 'masa madre', 'brioche', 'pan dulce', 'bollos', 'panecillos', 'suscripcion de pan'],
    services: [
      { index: 0, terms: ['masa madre', 'sourdough'] },
      { index: 1, terms: ['brioche', 'pan dulce', 'pastry'] },
      { index: 2, terms: ['brunch', 'desayuno'] },
      { index: 3, terms: ['bollos', 'panecillos'] },
      { index: 4, terms: ['suscripcion', 'semanal'] },
    ],
  },
  'fresh-dairy': {
    terms: ['lacteos', 'lácteos', 'leche', 'yogurt', 'queso', 'mantequilla', 'crema', 'sin lactosa'],
    services: [
      { index: 0, terms: ['leche', 'yogurt'] },
      { index: 1, terms: ['tabla de quesos', 'queso'] },
      { index: 2, terms: ['mantequilla', 'crema'] },
      { index: 3, terms: ['sin lactosa'] },
      { index: 4, terms: ['desayuno'] },
    ],
  },
  pharmacy: {
    terms: ['farmacia', 'receta', 'medicina', 'medicamento', 'botiquin', 'botiquín', 'primeros auxilios', 'articulos bebe', 'artículos bebé'],
    services: [
      { index: 0, terms: ['receta', 'prescription'] },
      { index: 1, terms: ['sin receta', 'over the counter'] },
      { index: 2, terms: ['botiquin', 'primeros auxilios'] },
      { index: 3, terms: ['bebe', 'baby care'] },
    ],
  },
  catering: {
    terms: ['catering', 'charolas', 'comida oficina', 'brunch', 'bocadillos', 'evento', 'coctel', 'cóctel', 'buffet', 'box lunch'],
    services: [
      { index: 0, terms: ['oficina', 'lunch trays'] },
      { index: 1, terms: ['brunch'] },
      { index: 2, terms: ['bocadillos', 'coctel'] },
      { index: 3, terms: ['buffet', 'familia'] },
      { index: 4, terms: ['box lunch', 'equipo'] },
    ],
  },
  'organic-butcher': {
    terms: ['carniceria', 'carnicería', 'carne', 'cortes', 'asado', 'pollo', 'carne molida', 'hamburguesa', 'huesos', 'caldo', 'steak'],
    services: [
      { index: 0, terms: ['asado', 'steak'] },
      { index: 1, terms: ['pollo'] },
      { index: 2, terms: ['carne molida', 'hamburguesa'] },
      { index: 3, terms: ['cortes especiales'] },
      { index: 4, terms: ['huesos', 'caldo'] },
    ],
  },
  fish: {
    terms: ['pescaderia', 'pescadería', 'pescado', 'mariscos', 'salmon', 'salmón', 'camaron', 'camarón', 'atun', 'atún', 'sushi'],
    services: [
      { index: 0, terms: ['salmon', 'filete'] },
      { index: 1, terms: ['camaron'] },
      { index: 2, terms: ['atun', 'sushi'] },
      { index: 3, terms: ['paquete familiar', 'mariscos'] },
      { index: 4, terms: ['pescado entero'] },
    ],
  },
  'organic-vegetables': {
    terms: ['verduras', 'vegetales', 'organico', 'orgánico', 'frutas', 'produce', 'lechuga', 'ensalada', 'temporada', 'jugos', 'smoothies', 'canasta'],
    services: [
      { index: 0, terms: ['caja semanal', 'organicas'] },
      { index: 1, terms: ['hojas', 'ensalada'] },
      { index: 2, terms: ['temporada', 'cocinar'] },
      { index: 3, terms: ['jugos', 'smoothies'] },
      { index: 4, terms: ['canasta', 'frutas'] },
    ],
  },
};

/* Canned follow-up questions per subcategory — used by the heuristic engine
   (and as a safety net for the AI engine). Each: { q, key, chips? } */
window.SERVI_FOLLOWUPS = {
  'home-cleaning':   [{ q: 'How big is the space?', key: 'size', chips: ['Studio', '1–2 bedrooms', '3+ bedrooms'] }, { q: 'Which areas need the most attention?', key: 'areas', chips: ['Kitchen', 'Bathrooms', 'Whole place'] }],
  'deep-cleaning':   [{ q: 'What triggered the deep clean?', key: 'reason', chips: ['Move in / out', 'After an event', 'Seasonal reset'] }, { q: 'Roughly how many bedrooms?', key: 'size', chips: ['1', '2', '3+'] }],
  'dry-cleaning':    [{ q: 'What needs cleaning?', key: 'items', chips: ['Suits', 'Dresses', 'Bedding'] }, { q: 'Need pickup & delivery?', key: 'pickup', chips: ['Yes', 'I’ll drop off'] }],
  'plumbing':        [{ q: 'Which fixture is affected?', key: 'fixture', chips: ['Sink', 'Toilet', 'Shower', 'Pipes'] }, { q: 'Is water leaking right now?', key: 'severity', chips: ['Yes, actively', 'A little', 'No'] }],
  'electrical':      [{ q: 'What’s the issue?', key: 'issue', chips: ['No power', 'Install fixture', 'Outlet / switch', 'Breaker tripping'] }, { q: 'How many points are affected?', key: 'count', chips: ['One', 'A few', 'Whole home'] }],
  'carpentry':       [{ q: 'What needs work?', key: 'object', chips: ['Door', 'Shelf / cabinet', 'Furniture'] }],
  'locksmith':       [{ q: 'What do you need?', key: 'need', chips: ['Locked out now', 'New lock', 'Key copy'] }, { q: 'Is this urgent?', key: 'urgent', chips: ['Yes, I’m stuck', 'No rush'] }],
  'handyman':        [{ q: 'What’s the task?', key: 'task', chips: ['Mount / hang something', 'Patch a wall', 'Install a fixture', 'Other'] }],
  'assembly-installation': [{ q: 'What are we assembling?', key: 'item', chips: ['Bed', 'Desk / shelf', 'Appliance', 'Other'] }],
  'tailoring':       [{ q: 'What kind of work?', key: 'work', chips: ['Hemming', 'Alterations', 'Zipper / repair'] }],
  'moving':          [{ q: 'How big is the move?', key: 'size', chips: ['A few items', 'Studio / 1BR', '2BR+'] }, { q: 'Do you need packing help?', key: 'packing', chips: ['Yes', 'Just moving'] }],
  'large-items':     [{ q: 'What’s being moved?', key: 'item', chips: ['Sofa', 'Mattress', 'Appliance', 'Other'] }, { q: 'Any stairs or elevator?', key: 'access', chips: ['Elevator', 'Stairs', 'Ground floor'] }],
  'errands':         [{ q: 'What’s the errand?', key: 'errand', chips: ['Groceries', 'Pharmacy', 'Pickup / drop-off'] }],
  'deliveries':      [{ q: 'What are we delivering?', key: 'item', chips: ['A package', 'Food / catering', 'Flowers / gift'] }],
  'massage':         [{ q: 'What type of massage?', key: 'type', chips: ['Relaxation', 'Deep tension', 'Recovery'] }, { q: 'For how many people?', key: 'people', chips: ['Just me', 'Two'] }],
  'therapist':       [{ q: 'What kind of support?', key: 'type', chips: ['Individual', 'Couples', 'Teen'] }],
  'personal-trainer':[{ q: 'What’s your goal?', key: 'goal', chips: ['Strength', 'Weight loss', 'Mobility'] }],
  'pet-care':        [{ q: 'What does your pet need?', key: 'need', chips: ['Walking', 'Sitting', 'Grooming'] }, { q: 'What kind of pet?', key: 'pet', chips: ['Dog', 'Cat', 'Other'] }],
  'child-care':      [{ q: 'When do you need care?', key: 'when', chips: ['After school', 'Evening', 'Weekend'] }, { q: 'Ages of the kids?', key: 'ages', chips: ['Infant', 'Toddler', 'School-age'] }],
  'elder-assistance':[{ q: 'What kind of help?', key: 'help', chips: ['Companionship', 'Appointments', 'Daily tasks'] }],
  'catering':        [{ q: 'What’s the occasion?', key: 'occasion', chips: ['Office', 'Party', 'Small group'] }, { q: 'Roughly how many people?', key: 'guests', chips: ['<10', '10–25', '25+'] }],
  'pharmacy':        [{ q: 'What do you need?', key: 'need', chips: ['Prescription', 'Over-the-counter', 'Baby care'] }],
};

/* Generic fallback when nothing matches / off-catalog request. */
window.SERVI_GENERIC_FOLLOWUPS = [
  { q: 'Roughly when do you need it?', key: 'timing', chips: ['As soon as possible', 'This week', 'Flexible'] },
  { q: 'Anything we should know up front?', key: 'notes' },
];
