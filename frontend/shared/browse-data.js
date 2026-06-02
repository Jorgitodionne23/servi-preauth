// Shared catalog data for browse.html and service.html
window.discoveryFallbackByCategory = {
  cleaning: '/assets/discovery/cleaning-category.jpg',
  repair: '/assets/discovery/repair-category.jpg',
  moving: '/assets/discovery/moving-category.jpg',
  wellness: '/assets/discovery/wellness-category.jpg',
  suppliers: '/assets/discovery/suppliers-category.jpg',
};

window.discoverySubcategoryImages = {
  cleaning: {
    'home-cleaning': '/assets/discovery/subcategories/home-cleaning.jpg',
    'deep-cleaning': '/assets/discovery/subcategories/deep-cleaning.jpg',
    'dry-cleaning': '/assets/discovery/subcategories/dry-cleaning.jpg',
  },
  repair: {
    gardening: '/assets/discovery/subcategories/gardening.jpg',
    plumbing: '/assets/discovery/subcategories/plumbing.jpg',
    electrical: '/assets/discovery/subcategories/electrical.jpg',
    carpentry: '/assets/discovery/subcategories/carpentry.jpg',
    locksmith: '/assets/discovery/subcategories/locksmith.jpg',
    handyman: '/assets/discovery/subcategories/handyman.jpg',
    'assembly-installation': '/assets/discovery/subcategories/assembly-installation.jpg',
    tailoring: '/assets/discovery/subcategories/tailoring.jpg',
  },
  moving: {
    moving: '/assets/discovery/subcategories/moving.jpg',
    'large-items': '/assets/discovery/subcategories/large-items.jpg',
    errands: '/assets/discovery/subcategories/errands.jpg',
    deliveries: '/assets/discovery/subcategories/deliveries.jpg',
  },
  wellness: {
    massage: '/assets/discovery/subcategories/massage.jpg',
    therapist: '/assets/discovery/subcategories/therapist.jpg',
    'personal-trainer': '/assets/discovery/subcategories/personal-trainer.jpg',
    'pet-care': '/assets/discovery/subcategories/pet-care.jpg',
    'child-care': '/assets/discovery/subcategories/child-care.jpg',
    'elder-assistance': '/assets/discovery/subcategories/elder-assistance.jpg',
  },
  suppliers: {
    'artisan-bread': '/assets/discovery/subcategories/artisan-bread.jpg',
    'fresh-dairy': '/assets/discovery/subcategories/fresh-dairy.jpg',
    pharmacy: '/assets/discovery/subcategories/pharmacy.jpg',
    catering: '/assets/discovery/subcategories/catering.jpg',
    'organic-butcher': '/assets/discovery/subcategories/organic-butcher.jpg',
    fish: '/assets/discovery/subcategories/fish.jpg',
    'organic-vegetables': '/assets/discovery/subcategories/organic-vegetables.jpg',
  },
};

window.browseCategoryData = {
  cleaning: {
    subcategories: [
      {
        key: 'home-cleaning',
        label: { es: 'Limpieza del hogar', en: 'Home cleaning' },
        services: {
          es: ['Limpieza semanal de departamento', 'Limpieza de cocina y estufa', 'Limpieza completa de baños', 'Sacudir y aspirar sala y recámaras', 'Limpieza antes de recibir visitas'],
          en: ['Weekly apartment cleaning', 'Kitchen and stove cleaning', 'Full bathroom cleaning', 'Dusting and vacuuming bedrooms and living room', 'Pre-guest home refresh'],
        },
        serviceKeywords: ['apartment,cleaning', 'kitchen,cleaning', 'bathroom,cleaning', 'vacuum,livingroom', 'tidy,home'],
        serviceImages: ['photo-1556909114-f6e7ad7d3136', 'photo-1556910103-1c02745aae4d', 'photo-1584622650111-993a426fbf0a', 'photo-1581578731548-c64695cc6952', 'photo-1556228453-efd6c1ff04f6'],
      },
      {
        key: 'deep-cleaning',
        label: { es: 'Limpieza profunda', en: 'Deep cleaning' },
        services: {
          es: ['Limpieza profunda post fiesta', 'Limpieza interior de horno y refrigerador', 'Desincrustado de sarro en baños', 'Limpieza de closets y alacenas', 'Limpieza estacional de toda la casa'],
          en: ['Post-party deep cleaning', 'Oven and refrigerator interior cleaning', 'Bathroom grout and scale removal', 'Closet and pantry deep clean', 'Seasonal whole-home deep cleaning'],
        },
        serviceKeywords: ['messy,kitchen', 'oven,clean', 'bathroom,scrub', 'pantry,organized', 'cleaning,supplies'],
        serviceImages: ['photo-1527515637462-cff94eecc1ac', 'photo-1604014237800-1c9102c219da', 'photo-1585152968992-d2b9444408cc', 'photo-1585421514738-01798e348b17', 'photo-1583845112203-29329902332e'],
      },
      {
        key: 'dry-cleaning',
        label: { es: 'Tintorería', en: 'Dry cleaning' },
        services: {
          es: ['Tintorería para trajes y sacos', 'Quitado de manchas en vestidos', 'Lavado de edredones y cobijas', 'Limpieza de cortinas y blancos', 'Recolección y entrega de prendas en la semana'],
          en: ['Dry cleaning for suits and blazers', 'Dress stain removal', 'Blanket and comforter cleaning', 'Curtain and linen cleaning', 'Weekday garment pickup and delivery'],
        },
        serviceKeywords: ['suit,hanger', 'dress,fabric', 'blanket,laundry', 'curtains,window', 'garment,bag'],
        serviceImages: ['photo-1549037173-e3b717902c57', 'photo-1581578017093-cd30fce4eeb7', 'photo-1596433904500-97b901c5d274', 'photo-1573507811472-909cd17e834d', 'photo-1604335398980-ededcadcc37d'],
      },
    ],
  },
  repair: {
    subcategories: [
      {
        key: 'gardening',
        label: { es: 'Jardinería', en: 'Gardening' },
        services: {
          es: ['Corte de pasto', 'Mantenimiento general de jardín', 'Poda de arbustos y setos', 'Revisión de sistema de riego', 'Retiro de hojas y limpieza exterior'],
          en: ['Lawn mowing', 'General garden maintenance', 'Shrub and hedge trimming', 'Irrigation system check', 'Leaf removal and outdoor cleanup'],
        },
        serviceKeywords: ['lawn,mower', 'garden,tools', 'hedge,trimmer', 'sprinkler,garden', 'rake,leaves'],
      },
      {
        key: 'plumbing',
        label: { es: 'Plomería', en: 'Plumbing' },
        services: {
          es: ['Destape de lavabo o fregadero', 'Reparación de fuga en WC', 'Cambio de llave o mezcladora', 'Diagnóstico de boiler o calentador', 'Reparación de fuga en tubería', 'Reparación de baja presión de agua'],
          en: ['Sink or drain unclogging', 'Toilet leak repair', 'Faucet or mixer replacement', 'Water heater diagnosis', 'Pipe leak repair', 'Low water pressure repair'],
        },
        serviceKeywords: ['drain,sink', 'toilet,plumbing', 'faucet,kitchen', 'water,heater', 'pipe,leak', 'water,pressure'],
      },
      {
        key: 'electrical',
        label: { es: 'Electricidad', en: 'Electrical' },
        services: {
          es: ['Instalación de lámparas o luminarias', 'Cambio de apagadores y contactos', 'Diagnóstico de corto o breaker disparado', 'Instalación de ventilador de techo', 'Revisión de cableado interior'],
          en: ['Light fixture installation', 'Outlet and switch replacement', 'Short circuit or breaker troubleshooting', 'Ceiling fan installation', 'Interior wiring inspection'],
        },
        serviceKeywords: ['lamp,ceiling', 'outlet,electrical', 'circuit,breaker', 'ceiling,fan', 'wiring,electrician'],
      },
      {
        key: 'carpentry',
        label: { es: 'Carpintería', en: 'Carpentry' },
        services: {
          es: ['Instalación de repisas a medida', 'Reparación de puertas de clóset o gabinete', 'Ajuste de puertas interiores', 'Reparación de muebles de madera', 'Colocación de zoclos y molduras'],
          en: ['Custom shelf installation', 'Closet or cabinet door repair', 'Interior door alignment', 'Wood furniture repair', 'Baseboard and trim installation'],
        },
        serviceKeywords: ['shelf,wood', 'cabinet,wood', 'wooden,door', 'furniture,carpenter', 'baseboard,molding'],
      },
      {
        key: 'locksmith',
        label: { es: 'Cerrajería', en: 'Locksmith' },
        services: {
          es: ['Apertura de puerta por olvido de llaves', 'Apertura de auto por olvido de llaves', 'Duplicado de llaves', 'Instalación de cerradura inteligente', 'Ajuste de cerradura que se atora'],
          en: ['Emergency home lockout', 'Car lockouts', 'Key duplication', 'Smart lock installation', 'Stuck lock adjustment'],
        },
        serviceKeywords: ['door,key', 'car,lockout', 'key,duplication', 'smart,lock', 'lock,handle'],
      },
      {
        key: 'handyman',
        label: { es: 'Handyman', en: 'Handyman' },
        services: {
          es: ['Montaje de TV en muro', 'Resane de hoyos y grietas pequeñas', 'Instalación de cortineros o persianas', 'Sellado de silicon en cocina o baño', 'Colgado de cuadros, espejos o accesorios'],
          en: ['TV wall mounting', 'Small wall patching and repairs', 'Curtain rod or blind installation', 'Kitchen or bathroom caulking', 'Hanging mirrors, frames, or accessories'],
        },
        serviceKeywords: ['tv,wall', 'wall,patch', 'curtain,rod', 'caulk,bathroom', 'frame,wall'],
      },
      {
        key: 'assembly-installation',
        label: { es: 'Montaje e instalación', en: 'Assembly & installation' },
        services: {
          es: ['Armado de cama o base', 'Ensamble de escritorio o librero', 'Instalación de estantería modular', 'Conexión de lavadora o secadora', 'Instalación de muebles listos para armar'],
          en: ['Bed frame assembly', 'Desk or bookcase assembly', 'Modular shelving installation', 'Washer or dryer hookup', 'Flat-pack furniture installation'],
        },
        serviceKeywords: ['bed,frame', 'desk,bookshelf', 'shelving,modular', 'washer,laundry', 'flatpack,furniture'],
      },
      {
        key: 'tailoring',
        label: { es: 'Sastrería', en: 'Tailoring' },
        services: {
          es: ['Dobladillo de pantalones', 'Ajuste de vestido o falda', 'Cambio de cierre', 'Ajuste de saco o traje', 'Modificación de cortinas o manteles'],
          en: ['Pant hemming', 'Dress or skirt alterations', 'Zipper replacement', 'Blazer or suit tailoring', 'Curtain or tablecloth alterations'],
        },
        serviceKeywords: ['sewing,pants', 'dress,sewing', 'zipper,clothing', 'blazer,tailor', 'tablecloth,fabric'],
      },
    ],
  },
  moving: {
    subcategories: [
      {
        key: 'moving',
        label: { es: 'Mudanzas', en: 'Moving' },
        services: {
          es: ['Mudanza de departamento dentro de la ciudad', 'Ayuda para empacar cajas', 'Carga y descarga de camioneta', 'Apoyo para instalarse en nuevo hogar'],
          en: ['In-city apartment move', 'Packing help for moving boxes', 'Truck loading and unloading', 'Move-in setup assistance'],
        },
        serviceKeywords: ['moving,boxes', 'packing,box', 'moving,truck', 'newhome,unpacking'],
      },
      {
        key: 'large-items',
        label: { es: 'Objetos grandes', en: 'Large items' },
        services: {
          es: ['Transporte de sofá o sala', 'Movimiento de colchón y base', 'Traslado de refrigerador o lavadora', 'Entrega de comedor o mesa grande'],
          en: ['Sofa transport', 'Mattress and bed base moving', 'Refrigerator or washer relocation', 'Large dining table delivery'],
        },
        serviceKeywords: ['sofa,couch', 'mattress,bed', 'refrigerator,kitchen', 'dining,table'],
      },
      {
        key: 'errands',
        label: { es: 'Mandados', en: 'Errands' },
        services: {
          es: ['Compra de súper urgente', 'Recoger medicinas en farmacia', 'Entrega de documentos o llaves', 'Devoluciones y cambios en tiendas'],
          en: ['Urgent grocery run', 'Pharmacy pickup', 'Document or key drop-off', 'Store returns and exchanges'],
        },
        serviceKeywords: ['grocery,bag', 'pharmacy,medicine', 'envelope,documents', 'shopping,bag'],
      },
      {
        key: 'deliveries',
        label: { es: 'Entregas', en: 'Deliveries' },
        services: {
          es: ['Entrega exprés el mismo día', 'Entrega de compra grande de tienda', 'Entrega de charolas o catering', 'Entrega de flores o regalos', 'Ruta programada de entregas recurrentes'],
          en: ['Same-day express delivery', 'Large store purchase delivery', 'Catering tray delivery', 'Flower or gift delivery', 'Scheduled recurring delivery route'],
        },
        serviceKeywords: ['delivery,box', 'package,delivery', 'catering,tray', 'flowers,bouquet', 'delivery,van'],
      },
    ],
  },
  wellness: {
    subcategories: [
      {
        key: 'massage',
        label: { es: 'Masaje', en: 'Massage' },
        services: {
          es: ['Masaje relajante a domicilio', 'Masaje descontracturante de espalda', 'Masaje para dos personas', 'Masaje de recuperación muscular', 'Sesión de masaje después de viaje o estrés'],
          en: ['In-home relaxation massage', 'Deep-tension back massage', 'Couples massage session', 'Muscle recovery massage', 'Post-travel or stress relief massage'],
        },
        serviceKeywords: ['massage,relax', 'back,massage', 'couples,spa', 'sports,massage', 'spa,oil'],
      },
      {
        key: 'therapist',
        label: { es: 'Terapeuta', en: 'Therapist' },
        services: {
          es: ['Sesión de terapia individual en línea', 'Acompañamiento por ansiedad o estrés', 'Terapia de pareja', 'Apoyo en duelo o transición personal', 'Sesión inicial para adolescente'],
          en: ['Online individual therapy session', 'Stress and anxiety counseling', 'Couples therapy', 'Grief or life-transition support', 'Introductory teen counseling session'],
        },
        serviceKeywords: ['therapy,laptop', 'counseling,session', 'couple,therapy', 'comfort,support', 'teen,counseling'],
      },
      {
        key: 'personal-trainer',
        label: { es: 'Entrenador personal', en: 'Personal trainer' },
        services: {
          es: ['Rutina de fuerza en casa', 'Inicio de plan para bajar de peso', 'Sesión de movilidad y estiramiento', 'Entrenamiento para principiantes', 'Acondicionamiento físico de bajo impacto'],
          en: ['At-home strength workout', 'Weight-loss plan kickoff', 'Mobility and stretching session', 'Beginner fitness training', 'Low-impact conditioning workout'],
        },
        serviceKeywords: ['home,workout', 'fitness,weights', 'stretching,yoga', 'beginner,gym', 'pilates,mat'],
      },
      {
        key: 'pet-care',
        label: { es: 'Cuidado de mascotas', en: 'Pet care' },
        services: {
          es: ['Paseo diario para perro', 'Pet sitting durante viaje', 'Baño y cepillado básico', 'Visita para dar alimento y agua', 'Apoyo para administrar medicamento'],
          en: ['Daily dog walking', 'Pet sitting during travel', 'Basic bath and brushing', 'Feeding and water refill visit', 'Medication support visit'],
        },
        serviceKeywords: ['dog,walking', 'cat,pet', 'dog,bath', 'dog,bowl', 'pet,medicine'],
      },
      {
        key: 'child-care',
        label: { es: 'Cuidado infantil', en: 'Child care' },
        services: {
          es: ['Niñera por la tarde después de escuela', 'Cuidado nocturno para salida de los papás', 'Recoger a niños y acompañarlos en casa', 'Apoyo de niñera en fin de semana', 'Cuidado para bebé por horas'],
          en: ['After-school babysitting', 'Evening babysitter for date night', 'School pickup and in-home care', 'Weekend nanny support', 'Hourly infant care'],
        },
        serviceKeywords: ['babysitter,kids', 'babysitting,evening', 'kids,school', 'nanny,kids', 'baby,nursery'],
      },
      {
        key: 'elder-assistance',
        label: { es: 'Asistencia a mayores', en: 'Elder assistance' },
        services: {
          es: ['Visita de compañía en casa', 'Recordatorio y apoyo con medicamentos', 'Acompañamiento a consulta médica', 'Ayuda ligera para preparar alimentos', 'Apoyo en caminatas y movilidad básica'],
          en: ['Companion visit at home', 'Medication reminder support', 'Medical appointment accompaniment', 'Light meal-prep assistance', 'Walking and basic mobility support'],
        },
        serviceKeywords: ['elderly,companion', 'pills,elderly', 'doctor,senior', 'meal,kitchen', 'senior,walking'],
      },
    ],
  },
  suppliers: {
    subcategories: [
      {
        key: 'artisan-bread',
        label: { es: 'Pan artesanal', en: 'Artisan bread' },
        services: {
          es: ['Pedido de pan de masa madre', 'Caja de pan dulce y brioche', 'Pan para brunch o desayuno', 'Bollos y panecillos para cena', 'Suscripción semanal de pan'],
          en: ['Sourdough bread order', 'Brioche and pastry box', 'Brunch or breakfast bakery order', 'Dinner rolls and buns order', 'Weekly bread subscription'],
        },
        serviceKeywords: ['sourdough,bread', 'brioche,pastry', 'bakery,breakfast', 'dinner,rolls', 'bread,loaf'],
      },
      {
        key: 'fresh-dairy',
        label: { es: 'Lácteos frescos', en: 'Fresh dairy' },
        services: {
          es: ['Reposición de leche y yogurt', 'Tabla de quesos artesanales', 'Pedido de mantequilla y crema', 'Entrega de lácteos sin lactosa', 'Combo lácteo para desayunos'],
          en: ['Milk and yogurt restock', 'Artisan cheese board order', 'Butter and cream delivery', 'Lactose-free dairy delivery', 'Breakfast dairy bundle'],
        },
        serviceKeywords: ['milk,yogurt', 'cheese,board', 'butter,cream', 'milk,carton', 'dairy,breakfast'],
      },
      {
        key: 'pharmacy',
        label: { es: 'Farmacia', en: 'Pharmacy' },
        services: {
          es: ['Recoger receta el mismo día', 'Compra de medicamento sin receta', 'Reposición de botiquín básico', 'Pedido de artículos para bebé'],
          en: ['Same-day prescription pickup', 'Over-the-counter medication order', 'First-aid kit refill', 'Baby care essentials order'],
        },
        serviceKeywords: ['prescription,pills', 'medicine,bottle', 'firstaid,kit', 'baby,care'],
      },
      {
        key: 'catering',
        label: { es: 'Catering', en: 'Catering' },
        services: {
          es: ['Charolas para comida de oficina', 'Servicio de brunch para reunión', 'Bocadillos para evento o cóctel', 'Buffet familiar para celebración', 'Box lunches para equipo pequeño'],
          en: ['Office lunch trays', 'Brunch catering setup', 'Cocktail bites for events', 'Family buffet catering', 'Boxed lunches for small teams'],
        },
        serviceKeywords: ['lunch,office', 'brunch,buffet', 'canape,appetizer', 'buffet,party', 'lunch,box'],
      },
      {
        key: 'organic-butcher',
        label: { es: 'Carnicería orgánica', en: 'Organic butcher' },
        services: {
          es: ['Pedido de cortes para asado', 'Paquete semanal de pollo', 'Carne molida para hamburguesas', 'Cortes especiales por encargo', 'Huesos y caldo para cocina casera'],
          en: ['Steak and grill order', 'Weekly chicken pack', 'Ground meat for burgers', 'Specialty cuts by request', 'Soup bones and broth staples'],
        },
        serviceKeywords: ['steak,beef', 'chicken,raw', 'ground,beef', 'butcher,meat', 'bone,broth'],
      },
      {
        key: 'fish',
        label: { es: 'Pescadería', en: 'Fish' },
        services: {
          es: ['Entrega de filete de salmón', 'Pedido de camarón fresco', 'Atún para sashimi o sushi', 'Paquete familiar de mariscos', 'Pescado entero limpio y listo para cocinar'],
          en: ['Salmon fillet delivery', 'Fresh shrimp order', 'Sushi-grade tuna order', 'Family seafood pack', 'Whole fish cleaned and ready to cook'],
        },
        serviceKeywords: ['salmon,fillet', 'shrimp,seafood', 'tuna,sushi', 'seafood,platter', 'whole,fish'],
      },
      {
        key: 'organic-vegetables',
        label: { es: 'Vegetales orgánicos', en: 'Organic vegetables' },
        services: {
          es: ['Caja semanal de verduras orgánicas', 'Reposición de hojas y ensaladas', 'Verduras de temporada para cocinar', 'Paquete para jugos y smoothies', 'Canasta familiar de frutas y verduras'],
          en: ['Weekly organic produce box', 'Leafy greens and salad restock', 'Seasonal cooking vegetables', 'Juicing and smoothie bundle', 'Family fruit and vegetable basket'],
        },
        serviceKeywords: ['vegetables,box', 'lettuce,greens', 'vegetables,market', 'smoothie,fruit', 'fruit,basket'],
      },
    ],
  },
};
