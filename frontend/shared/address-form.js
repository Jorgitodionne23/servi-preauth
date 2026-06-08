/* ============================================================================
 * SERVI — Shared structured address form  (window.ServiAddress)
 * ----------------------------------------------------------------------------
 * Single source of truth for the detailed, CDMX-aware service-address form used
 * by account.html (saved address book) and service.html (booking panel).
 *
 * Why detailed: a SERVI specialist physically goes to the home/location, so
 * "calle + número" is rarely enough — apartment towers, interior units,
 * colonias, gated streets and casetas all need explicit references. This mirrors
 * Google's structured address components (street_number, route, subpremise,
 * locality, admin area, postal_code) + the delivery-instruction layer that apps
 * like Uber / Rappi / DoorDash add.
 *
 * Public API (all id-prefix based so multiple instances never collide):
 *   ServiAddress.fieldsHTML(prefix, opts)   -> HTML string for the field set
 *   ServiAddress.init(prefix, opts)         -> wire events + populate + fill
 *   ServiAddress.collect(prefix)            -> structured address object
 *   ServiAddress.fill(prefix, address)      -> populate inputs from an object
 *   ServiAddress.clear(prefix)              -> reset inputs
 *   ServiAddress.format(address, opts)      -> human-readable string
 *   ServiAddress.geolocate(prefix)          -> autofill via free reverse-geocode
 * ========================================================================== */
(function () {
  'use strict';

  // ─── Language ──────────────────────────────────────────────────────────────
  function lang() {
    var l = window.__lang || (function () {
      try { return localStorage.getItem('servi-lang'); } catch (e) { return null; }
    })() || 'es';
    return String(l).toLowerCase().indexOf('en') === 0 ? 'en' : 'es';
  }

  var DICT = {
    es: {
      typeLabel: 'Tipo de domicilio', typeHouse: 'Casa', typeApartment: 'Departamento',
      typeOffice: 'Oficina', typeOther: 'Otro',
      labelLabel: 'Etiqueta (opcional)', labelPh: 'Casa, Trabajo, Mamá…',
      street: 'Calle', streetPh: 'Av. Vasco de Quiroga',
      ext: 'No. exterior', extPh: '3800', int: 'No. interior / depto', intPh: 'Torre B-402',
      neighborhood: 'Colonia', neighborhoodPh: 'Santa Fe',
      municipality: 'Alcaldía / municipio', municipalityPh: 'Cuajimalpa de Morelos',
      city: 'Ciudad', state: 'Estado', postal: 'Código postal', postalPh: '05348',
      statePh: 'Selecciona un estado', cityPh: 'Selecciona una ciudad',
      locationBtn: 'Usar mi ubicación actual',
      locating: 'Permite el acceso a tu ubicación…', resolving: 'Buscando tu dirección…',
      updated: 'Dirección actualizada.', unsupported: 'La ubicación no está disponible en este navegador.',
      denied: 'No se permitió el acceso. Puedes escribir tu dirección manualmente.',
      locError: 'No pudimos obtener tu ubicación. Escríbela manualmente.',
      detailsToggle: 'Detalles para que el especialista te encuentre',
      detailsHint: 'Entre más claro, más rápido y puntual llega tu especialista.',
      between: 'Entre calles', betweenPh: 'Entre Av. Reforma y Calle 5',
      references: 'Referencias para llegar', referencesPh: 'Casa azul con portón negro, junto a la tienda OXXO…',
      referencesCompact: 'Referencias y acceso', referencesCompactPh: 'Casa azul con portón negro, código de acceso, qué decir en caseta…',
      access: 'Instrucciones de acceso', accessPh: 'Código de portón, qué decir en caseta, dónde estacionarse…',
      contactName: '¿Quién recibe? (opcional)', contactNamePh: 'Nombre de quien atiende',
      contactPhone: 'Teléfono de contacto (opcional)', contactPhonePh: '55 1234 5678',
      defaultLabel: 'Usar como predeterminada',
      reqStreet: 'La calle es obligatoria.',
    },
    en: {
      typeLabel: 'Address type', typeHouse: 'House', typeApartment: 'Apartment',
      typeOffice: 'Office', typeOther: 'Other',
      labelLabel: 'Label (optional)', labelPh: 'Home, Work, Mom’s…',
      street: 'Street', streetPh: 'Av. Vasco de Quiroga',
      ext: 'Exterior no.', extPh: '3800', int: 'Interior / unit no.', intPh: 'Tower B-402',
      neighborhood: 'Neighborhood', neighborhoodPh: 'Santa Fe',
      municipality: 'Borough / municipality', municipalityPh: 'Cuajimalpa de Morelos',
      city: 'City', state: 'State', postal: 'Postal code', postalPh: '05348',
      statePh: 'Select a state', cityPh: 'Select a city',
      locationBtn: 'Use my current location',
      locating: 'Allow access to your location…', resolving: 'Finding your address…',
      updated: 'Address updated.', unsupported: 'Location is not available in this browser.',
      denied: 'Access denied. You can type your address manually.',
      locError: 'Could not get your location. Please type it manually.',
      detailsToggle: 'Details so your specialist can find you',
      detailsHint: 'The clearer it is, the faster and more punctual your specialist arrives.',
      between: 'Between streets', betweenPh: 'Between Av. Reforma and Calle 5',
      references: 'How to find it', referencesPh: 'Blue house with a black gate, next to the OXXO store…',
      referencesCompact: 'How to find it & access', referencesCompactPh: 'Blue house with black gate, access code, what to tell the doorman…',
      access: 'Access instructions', accessPh: 'Gate code, what to tell the doorman, where to park…',
      contactName: 'Who receives? (optional)', contactNamePh: 'Name of who will be there',
      contactPhone: 'Contact phone (optional)', contactPhonePh: '55 1234 5678',
      defaultLabel: 'Set as default',
      reqStreet: 'Street is required.',
    },
  };
  function t() { return DICT[lang()]; }

  // ─── Mexico state / city options ───────────────────────────────────────────
  var MEXICO_ADDRESS_OPTIONS = [
    { state: 'Aguascalientes', cities: ['Aguascalientes', 'Calvillo', 'Jesus Maria'] },
    { state: 'Baja California', cities: ['Tijuana', 'Mexicali', 'Ensenada', 'Rosarito', 'Tecate'] },
    { state: 'Baja California Sur', cities: ['La Paz', 'Los Cabos', 'Cabo San Lucas', 'San Jose del Cabo'] },
    { state: 'Campeche', cities: ['Campeche', 'Ciudad del Carmen', 'Champoton'] },
    { state: 'Chiapas', cities: ['Tuxtla Gutierrez', 'San Cristobal de las Casas', 'Tapachula', 'Comitan'] },
    { state: 'Chihuahua', cities: ['Chihuahua', 'Ciudad Juarez', 'Delicias', 'Cuauhtemoc', 'Parral'] },
    { state: 'Ciudad de México', cities: ['Ciudad de México', 'Alvaro Obregon', 'Azcapotzalco', 'Benito Juarez', 'Coyoacan', 'Cuajimalpa de Morelos', 'Cuauhtemoc', 'Gustavo A. Madero', 'Iztacalco', 'Iztapalapa', 'La Magdalena Contreras', 'Miguel Hidalgo', 'Milpa Alta', 'Tlahuac', 'Tlalpan', 'Venustiano Carranza', 'Xochimilco'] },
    { state: 'Coahuila', cities: ['Saltillo', 'Torreon', 'Monclova', 'Piedras Negras', 'Acuña'] },
    { state: 'Colima', cities: ['Colima', 'Manzanillo', 'Villa de Alvarez', 'Tecoman'] },
    { state: 'Durango', cities: ['Durango', 'Gomez Palacio', 'Lerdo'] },
    { state: 'Estado de México', cities: ['Toluca', 'Naucalpan', 'Tlalnepantla', 'Ecatepec', 'Metepec', 'Huixquilucan', 'Atizapan de Zaragoza', 'Nezahualcoyotl', 'Cuautitlan Izcalli'] },
    { state: 'Guanajuato', cities: ['Leon', 'Guanajuato', 'Irapuato', 'Celaya', 'San Miguel de Allende', 'Salamanca'] },
    { state: 'Guerrero', cities: ['Acapulco', 'Chilpancingo', 'Iguala', 'Zihuatanejo'] },
    { state: 'Hidalgo', cities: ['Pachuca', 'Tulancingo', 'Tula de Allende', 'Mineral de la Reforma'] },
    { state: 'Jalisco', cities: ['Guadalajara', 'Zapopan', 'Tlaquepaque', 'Tonalá', 'Tlajomulco de Zuñiga', 'Puerto Vallarta'] },
    { state: 'Michoacán', cities: ['Morelia', 'Uruapan', 'Zamora', 'Lazaro Cardenas'] },
    { state: 'Morelos', cities: ['Cuernavaca', 'Jiutepec', 'Cuautla', 'Temixco'] },
    { state: 'Nayarit', cities: ['Tepic', 'Bahia de Banderas', 'Compostela'] },
    { state: 'Nuevo León', cities: ['Monterrey', 'San Pedro Garza Garcia', 'San Nicolas de los Garza', 'Guadalupe', 'Apodaca', 'Santa Catarina', 'Escobedo'] },
    { state: 'Oaxaca', cities: ['Oaxaca de Juarez', 'Salina Cruz', 'Juchitan de Zaragoza', 'Puerto Escondido'] },
    { state: 'Puebla', cities: ['Puebla', 'Cholula', 'San Andres Cholula', 'Tehuacan', 'Atlixco'] },
    { state: 'Querétaro', cities: ['Queretaro', 'San Juan del Rio', 'Corregidora', 'El Marques'] },
    { state: 'Quintana Roo', cities: ['Cancun', 'Playa del Carmen', 'Tulum', 'Chetumal', 'Cozumel'] },
    { state: 'San Luis Potosí', cities: ['San Luis Potosi', 'Soledad de Graciano Sanchez', 'Ciudad Valles', 'Matehuala'] },
    { state: 'Sinaloa', cities: ['Culiacan', 'Mazatlan', 'Los Mochis', 'Guasave'] },
    { state: 'Sonora', cities: ['Hermosillo', 'Ciudad Obregon', 'Nogales', 'San Luis Rio Colorado', 'Guaymas'] },
    { state: 'Tabasco', cities: ['Villahermosa', 'Cardenas', 'Comalcalco', 'Paraiso'] },
    { state: 'Tamaulipas', cities: ['Tampico', 'Reynosa', 'Matamoros', 'Ciudad Victoria', 'Nuevo Laredo'] },
    { state: 'Tlaxcala', cities: ['Tlaxcala', 'Apizaco', 'Huamantla', 'Chiautempan'] },
    { state: 'Veracruz', cities: ['Veracruz', 'Xalapa', 'Boca del Rio', 'Coatzacoalcos', 'Cordoba', 'Orizaba'] },
    { state: 'Yucatán', cities: ['Merida', 'Valladolid', 'Progreso', 'Tizimin'] },
    { state: 'Zacatecas', cities: ['Zacatecas', 'Guadalupe', 'Fresnillo', 'Jerez'] },
  ];

  function esc(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function norm(v) {
    return String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function normalizeState(value) {
    var n = norm(value); if (!n) return '';
    var aliases = {
      cdmx: 'Ciudad de México', 'ciudad de mexico': 'Ciudad de México', 'mexico city': 'Ciudad de México',
      'distrito federal': 'Ciudad de México', mexico: 'Estado de México', 'estado de mexico': 'Estado de México',
      michoacan: 'Michoacán', queretaro: 'Querétaro', 'san luis potosi': 'San Luis Potosí', yucatan: 'Yucatán',
    };
    if (aliases[n]) return aliases[n];
    var m = MEXICO_ADDRESS_OPTIONS.find(function (i) { return norm(i.state) === n; });
    return m ? m.state : value;
  }

  // ─── Scoped styles (injected once) ─────────────────────────────────────────
  function ensureStyles() {
    if (document.getElementById('servi-addr-styles')) return;
    var css = '' +
      '.servi-addr{display:flex;flex-direction:column;gap:14px}' +
      '.servi-addr .sa-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}' +
      '.servi-addr .sa-row.sa-3{grid-template-columns:1fr 1fr 1fr}' +
      '.servi-addr .sa-field{display:flex;flex-direction:column;gap:5px;min-width:0}' +
      '.servi-addr .sa-label{font-size:12.5px;font-weight:600;color:#444;letter-spacing:.01em}' +
      '.servi-addr .sa-input,.servi-addr select.sa-input,.servi-addr textarea.sa-input{' +
        'width:100%;box-sizing:border-box;border:1.5px solid #e2e2e2;border-radius:12px;' +
        'padding:11px 13px;font:inherit;font-size:14.5px;color:#111;background:#fff;outline:none;' +
        'transition:border-color .15s ease,box-shadow .15s ease}' +
      '.servi-addr .sa-input:focus,.servi-addr textarea.sa-input:focus,.servi-addr select.sa-input:focus{' +
        'border-color:#111;box-shadow:0 0 0 3px rgba(0,0,0,.06)}' +
      '.servi-addr .sa-input.sa-err{border-color:#e5484d;box-shadow:0 0 0 3px rgba(229,72,77,.12)}' +
      '.servi-addr textarea.sa-input{resize:vertical;min-height:60px;line-height:1.45}' +
      '.servi-addr .sa-type{display:flex;gap:8px;flex-wrap:wrap}' +
      '.servi-addr .sa-type label{flex:1 1 0;min-width:78px;display:flex;align-items:center;justify-content:center;gap:6px;' +
        'border:1.5px solid #e2e2e2;border-radius:12px;padding:10px 8px;font-size:13.5px;font-weight:600;' +
        'color:#555;cursor:pointer;background:#fff;transition:all .15s ease;text-align:center}' +
      '.servi-addr .sa-type label:hover{border-color:#bbb}' +
      '.servi-addr .sa-type input{position:absolute;opacity:0;pointer-events:none}' +
      '.servi-addr .sa-type input:checked + label,.servi-addr .sa-type label.sa-on{' +
        'border-color:#111;background:#111;color:#fff}' +
      '.servi-addr .sa-geo{display:inline-flex;align-items:center;gap:8px;align-self:flex-start;' +
        'border:1.5px solid #e2e2e2;border-radius:12px;background:#fafafa;padding:9px 14px;font:inherit;' +
        'font-size:13.5px;font-weight:600;color:#222;cursor:pointer;transition:all .15s ease}' +
      '.servi-addr .sa-geo:hover{border-color:#111;background:#f1f1f1}' +
      '.servi-addr .sa-geo svg{width:16px;height:16px}' +
      '.servi-addr .sa-geo[disabled]{opacity:.55;cursor:default}' +
      '.servi-addr .sa-geo-status{font-size:12.5px;color:#777;min-height:0}' +
      '.servi-addr .sa-geo-status.sa-ok{color:#1a7f37}.servi-addr .sa-geo-status.sa-bad{color:#e5484d}' +
      '.servi-addr details.sa-more{border:1.5px dashed #e2e2e2;border-radius:14px;padding:0;background:#fcfcfc;overflow:hidden}' +
      '.servi-addr details.sa-more[open]{background:#fff;border-style:solid}' +
      '.servi-addr details.sa-more > summary{list-style:none;cursor:pointer;padding:13px 15px;display:flex;' +
        'align-items:center;justify-content:space-between;gap:10px;font-size:14px;font-weight:700;color:#111}' +
      '.servi-addr details.sa-more > summary::-webkit-details-marker{display:none}' +
      '.servi-addr details.sa-more > summary .sa-chev{transition:transform .2s ease;flex:0 0 auto}' +
      '.servi-addr details.sa-more[open] > summary .sa-chev{transform:rotate(180deg)}' +
      '.servi-addr .sa-more-body{padding:2px 15px 16px;display:flex;flex-direction:column;gap:14px}' +
      '.servi-addr .sa-more-hint{font-size:12.5px;color:#888;margin:-2px 0 2px}' +
      '.servi-addr .sa-checkbox{display:flex;align-items:center;gap:9px;font-size:13.5px;color:#444;cursor:pointer}' +
      '.servi-addr .sa-checkbox input{width:16px;height:16px;accent-color:#111}' +
      '@media (max-width:560px){.servi-addr .sa-row,.servi-addr .sa-row.sa-3{grid-template-columns:1fr}}';
    var el = document.createElement('style');
    el.id = 'servi-addr-styles';
    el.textContent = css;
    document.head.appendChild(el);
  }

  // ─── Field set HTML ────────────────────────────────────────────────────────
  // opts: { showLabel=true, showDefault=false, openDetails=false, compact=false }
  // compact mode (used by the small service.html booking panel): keeps the
  // Address type selector but drops label, municipality, state/city dropdowns and
  // the contact/between/access detail fields — leaving street, ext/int, colonia,
  // CP, geolocation and a single "referencias / cómo llegar" notes field.
  function fieldsHTML(prefix, opts) {
    opts = opts || {};
    ensureStyles();
    var x = t();
    var p = prefix;
    var compact = !!opts.compact;
    var showLabel = !compact && opts.showLabel !== false;
    var typeOpts = [
      ['house', x.typeHouse, '🏠'], ['apartment', x.typeApartment, '🏢'],
      ['office', x.typeOffice, '💼'], ['other', x.typeOther, '📍'],
    ];
    var typeHTML = typeOpts.map(function (o, i) {
      var id = p + '_type_' + o[0];
      return '<span style="position:relative;flex:1 1 0;min-width:78px">' +
        '<input type="radio" name="' + p + '_type" id="' + id + '" value="' + o[0] + '"' + (i === 0 ? ' checked' : '') + '>' +
        '<label for="' + id + '"><span aria-hidden="true">' + o[2] + '</span>' + esc(o[1]) + '</label></span>';
    }).join('');

    function fld(id, label, inner) {
      return '<div class="sa-field"><label class="sa-label" for="' + id + '">' + esc(label) + '</label>' + inner + '</div>';
    }
    function input(id, ph, attrs) {
      return '<input class="sa-input" id="' + id + '" type="text" autocomplete="off" spellcheck="false" placeholder="' + esc(ph) + '"' + (attrs || '') + '>';
    }
    function area(id, ph) {
      return '<textarea class="sa-input" id="' + id + '" rows="2" spellcheck="false" placeholder="' + esc(ph) + '"></textarea>';
    }

    var html = '<div class="servi-addr" id="' + p + '_root">';

    // Address type
    html += '<div class="sa-field"><span class="sa-label">' + esc(x.typeLabel) + '</span>' +
      '<div class="sa-type" id="' + p + '_typewrap">' + typeHTML + '</div></div>';

    // Label (optional)
    if (showLabel) {
      html += fld(p + '_label', x.labelLabel, input(p + '_label', x.labelPh));
    }

    // Street + ext
    html += '<div class="sa-row"><div class="sa-field" style="grid-column:1 / -1">' +
      '<label class="sa-label" for="' + p + '_street">' + esc(x.street) + ' *</label>' +
      input(p + '_street', x.streetPh, ' autocomplete="address-line1"') + '</div></div>';
    html += '<div class="sa-row">' +
      fld(p + '_ext', x.ext, input(p + '_ext', x.extPh, ' inputmode="numeric"')) +
      fld(p + '_int', x.int, input(p + '_int', x.intPh)) + '</div>';

    if (compact) {
      // Colonia + CP (compact drops municipality + state/city dropdowns)
      html += '<div class="sa-row">' +
        fld(p + '_neighborhood', x.neighborhood, input(p + '_neighborhood', x.neighborhoodPh)) +
        fld(p + '_postal', x.postal, input(p + '_postal', x.postalPh, ' inputmode="numeric" autocomplete="postal-code"')) + '</div>';
    } else {
      // Colonia + municipality
      html += '<div class="sa-row">' +
        fld(p + '_neighborhood', x.neighborhood, input(p + '_neighborhood', x.neighborhoodPh)) +
        fld(p + '_municipality', x.municipality, input(p + '_municipality', x.municipalityPh)) + '</div>';
    }

    // Geolocation
    html += '<button class="sa-geo" type="button" id="' + p + '_geo">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M12 2v3"></path><path d="M12 19v3"></path><path d="M2 12h3"></path><path d="M19 12h3"></path>' +
      '<circle cx="12" cy="12" r="7"></circle><circle cx="12" cy="12" r="2"></circle></svg>' +
      '<span id="' + p + '_geolabel">' + esc(x.locationBtn) + '</span></button>' +
      '<div class="sa-geo-status" id="' + p + '_geostatus" aria-live="polite"></div>';

    if (!compact) {
      // State / city / postal
      html += '<div class="sa-row sa-3">' +
        fld(p + '_state', x.state, '<select class="sa-input" id="' + p + '_state"></select>') +
        fld(p + '_city', x.city, '<select class="sa-input" id="' + p + '_city"></select>') +
        fld(p + '_postal', x.postal, input(p + '_postal', x.postalPh, ' inputmode="numeric" autocomplete="postal-code"')) +
        '</div>';
    }

    // Collapsible "find me" details
    var detailsBody = '<div class="sa-more-hint">' + esc(x.detailsHint) + '</div>';
    if (compact) {
      detailsBody += fld(p + '_references', x.referencesCompact, area(p + '_references', x.referencesCompactPh));
    } else {
      detailsBody +=
        fld(p + '_between', x.between, input(p + '_between', x.betweenPh)) +
        fld(p + '_references', x.references, area(p + '_references', x.referencesPh)) +
        fld(p + '_access', x.access, area(p + '_access', x.accessPh)) +
        '<div class="sa-row">' +
        fld(p + '_contactName', x.contactName, input(p + '_contactName', x.contactNamePh)) +
        fld(p + '_contactPhone', x.contactPhone, input(p + '_contactPhone', x.contactPhonePh, ' inputmode="tel" autocomplete="tel"')) +
        '</div>';
    }
    html += '<details class="sa-more"' + (opts.openDetails ? ' open' : '') + '>' +
      '<summary>' + esc(x.detailsToggle) +
      '<svg class="sa-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>' +
      '</summary><div class="sa-more-body">' + detailsBody + '</div></details>';

    // Default checkbox (account book only)
    if (opts.showDefault) {
      html += '<label class="sa-checkbox"><input type="checkbox" id="' + p + '_default"><span>' + esc(x.defaultLabel) + '</span></label>';
    }

    html += '</div>';
    return html;
  }

  // ─── Dropdown population ───────────────────────────────────────────────────
  function setSelect(select, options, placeholder, selected) {
    if (!select) return;
    var sel = selected || select.value || '';
    var has = options.some(function (o) { return norm(o) === norm(sel); });
    select.innerHTML = '<option value="">' + esc(placeholder) + '</option>' + options.map(function (o) {
      return '<option value="' + esc(o) + '"' + (norm(o) === norm(sel) ? ' selected' : '') + '>' + esc(o) + '</option>';
    }).join('');
    if (sel && !has) select.insertAdjacentHTML('beforeend', '<option value="' + esc(sel) + '" selected>' + esc(sel) + '</option>');
  }
  function populateStates(prefix, selected) {
    var s = document.getElementById(prefix + '_state');
    setSelect(s, MEXICO_ADDRESS_OPTIONS.map(function (i) { return i.state; }), t().statePh, normalizeState(selected || (s && s.value) || ''));
  }
  function populateCities(prefix, selected, reset) {
    var c = document.getElementById(prefix + '_city');
    var st = normalizeState((document.getElementById(prefix + '_state') || {}).value || '');
    var cfg = MEXICO_ADDRESS_OPTIONS.find(function (i) { return i.state === st; });
    var sel = reset ? '' : (selected !== undefined ? selected : (c && c.value) || '');
    setSelect(c, cfg ? cfg.cities : [], t().cityPh, sel);
  }
  function setGeo(prefix, opts) {
    populateStates(prefix, (opts || {}).state);
    populateCities(prefix, (opts || {}).city);
  }

  // ─── Geolocation autofill (free, BigDataCloud) ─────────────────────────────
  function status(prefix, msg, kind) {
    var el = document.getElementById(prefix + '_geostatus');
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'sa-geo-status' + (kind === 'ok' ? ' sa-ok' : kind === 'bad' ? ' sa-bad' : '');
  }
  function reverseGeocode(latitude, longitude) {
    var langCode = lang();
    var url = 'https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' +
      encodeURIComponent(latitude) + '&longitude=' + encodeURIComponent(longitude) + '&localityLanguage=' + langCode;
    var controller = new AbortController();
    var to = setTimeout(function () { controller.abort(); }, 8000);
    return fetch(url, { signal: controller.signal }).then(function (r) {
      return r.ok ? r.json() : {};
    }).then(function (d) {
      var state = normalizeState(d.principalSubdivision || d.region || '');
      var city = d.city || d.locality || d.principalSubdivision || '';
      return {
        neighborhood: d.locality || '',
        city: norm(city) === 'mexico city' ? 'Ciudad de México' : city,
        state: state,
        postalCode: d.postcode || d.postalCode || '',
      };
    }).catch(function () { return {}; }).finally(function () { clearTimeout(to); });
  }
  function geolocate(prefix) {
    var x = t();
    var btn = document.getElementById(prefix + '_geo');
    if (!navigator.geolocation) { status(prefix, x.unsupported, 'bad'); return; }
    if (btn) btn.disabled = true;
    status(prefix, x.locating, null);
    navigator.geolocation.getCurrentPosition(function (pos) {
      status(prefix, x.resolving, null);
      reverseGeocode(pos.coords.latitude, pos.coords.longitude).then(function (a) {
        function set(id, val) { var el = document.getElementById(id); if (el && val && !el.value.trim()) el.value = val; }
        set(prefix + '_neighborhood', a.neighborhood);
        set(prefix + '_postal', a.postalCode);
        setGeo(prefix, { state: a.state || '', city: a.city || '' });
        status(prefix, x.updated, 'ok');
        if (btn) btn.disabled = false;
      });
    }, function (err) {
      status(prefix, err && err.code === 1 ? x.denied : x.locError, 'bad');
      if (btn) btn.disabled = false;
    }, { enableHighAccuracy: true, maximumAge: 300000, timeout: 12000 });
  }

  // ─── init / fill / collect / clear ─────────────────────────────────────────
  function getTypeWrap(prefix) { return document.getElementById(prefix + '_typewrap'); }

  function init(prefix, opts) {
    opts = opts || {};
    var stateSel = document.getElementById(prefix + '_state');
    if (stateSel && !stateSel._saWired) {
      stateSel._saWired = true;
      stateSel.addEventListener('change', function () { populateCities(prefix, '', true); });
    }
    var geoBtn = document.getElementById(prefix + '_geo');
    if (geoBtn && !geoBtn._saWired) {
      geoBtn._saWired = true;
      geoBtn.addEventListener('click', function () { geolocate(prefix); });
    }
    setGeo(prefix, { state: '', city: '' });
    if (opts.address) fill(prefix, opts.address);
  }

  function setVal(id, v) { var el = document.getElementById(id); if (el) el.value = v == null ? '' : v; }
  function getVal(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }

  function fill(prefix, a) {
    a = a || {};
    var type = a.address_type || 'house';
    var radio = document.getElementById(prefix + '_type_' + type);
    if (radio) radio.checked = true;
    setVal(prefix + '_label', a.label);
    setVal(prefix + '_street', a.street);
    setVal(prefix + '_ext', a.exterior_number);
    setVal(prefix + '_int', a.interior_number);
    setVal(prefix + '_neighborhood', a.neighborhood);
    setVal(prefix + '_municipality', a.municipality);
    setVal(prefix + '_postal', a.postal_code);
    setVal(prefix + '_between', a.between_streets);
    setVal(prefix + '_references', a.reference_notes);
    setVal(prefix + '_access', a.access_instructions);
    setVal(prefix + '_contactName', a.contact_name);
    setVal(prefix + '_contactPhone', a.contact_phone);
    setGeo(prefix, { state: a.state || '', city: a.city || '' });
    var def = document.getElementById(prefix + '_default');
    if (def) def.checked = !!a.is_default;
    // Open the details section if any "find me" field has content
    if (a.between_streets || a.reference_notes || a.access_instructions || a.contact_name || a.contact_phone) {
      var more = document.querySelector('#' + prefix + '_root details.sa-more');
      if (more) more.open = true;
    }
  }

  function collect(prefix) {
    var typeWrap = getTypeWrap(prefix);
    var typeInput = typeWrap ? typeWrap.querySelector('input[name="' + prefix + '_type"]:checked') : null;
    var def = document.getElementById(prefix + '_default');
    var out = {
      address_type: typeInput ? typeInput.value : 'house',
      label: getVal(prefix + '_label') || undefined,
      street: getVal(prefix + '_street'),
      exterior_number: getVal(prefix + '_ext') || undefined,
      interior_number: getVal(prefix + '_int') || undefined,
      neighborhood: getVal(prefix + '_neighborhood') || undefined,
      municipality: getVal(prefix + '_municipality') || undefined,
      city: getVal(prefix + '_city') || undefined,
      state: getVal(prefix + '_state') || undefined,
      postal_code: getVal(prefix + '_postal') || undefined,
      between_streets: getVal(prefix + '_between') || undefined,
      reference_notes: getVal(prefix + '_references') || undefined,
      access_instructions: getVal(prefix + '_access') || undefined,
      contact_name: getVal(prefix + '_contactName') || undefined,
      contact_phone: getVal(prefix + '_contactPhone') || undefined,
    };
    if (def) out.is_default = !!def.checked;
    return out;
  }

  function clear(prefix) {
    ['_label', '_street', '_ext', '_int', '_neighborhood', '_municipality', '_postal',
      '_between', '_references', '_access', '_contactName', '_contactPhone'].forEach(function (s) {
      setVal(prefix + s, '');
    });
    var house = document.getElementById(prefix + '_type_house');
    if (house) house.checked = true;
    var def = document.getElementById(prefix + '_default');
    if (def) def.checked = false;
    setGeo(prefix, { state: '', city: '' });
    status(prefix, '', null);
    var more = document.querySelector('#' + prefix + '_root details.sa-more');
    if (more) more.open = false;
  }

  function validate(prefix) {
    var street = document.getElementById(prefix + '_street');
    if (!street || !street.value.trim()) {
      if (street) { street.classList.add('sa-err'); street.focus(); }
      return false;
    }
    if (street) street.classList.remove('sa-err');
    return true;
  }

  // ─── format (human-readable) ───────────────────────────────────────────────
  function format(a, opts) {
    a = a || {};
    opts = opts || {};
    var line1 = [a.street, a.exterior_number].filter(Boolean).join(' ');
    if (a.interior_number) line1 += (line1 ? ', ' : '') + (lang() === 'es' ? 'Int. ' : 'Unit ') + a.interior_number;
    var line2 = [a.neighborhood, a.municipality, a.city, a.state].filter(Boolean).join(', ');
    if (a.postal_code) line2 += (line2 ? ' ' : '') + a.postal_code;
    var extra = [];
    var es = lang() === 'es';
    if (a.between_streets) extra.push((es ? 'Entre ' : 'Between ') + a.between_streets);
    if (a.reference_notes) extra.push((es ? 'Ref: ' : 'Ref: ') + a.reference_notes);
    if (a.access_instructions) extra.push((es ? 'Acceso: ' : 'Access: ') + a.access_instructions);
    if (a.contact_name) extra.push((es ? 'Recibe: ' : 'Receives: ') + a.contact_name + (a.contact_phone ? ' (' + a.contact_phone + ')' : ''));
    else if (a.contact_phone) extra.push((es ? 'Tel: ' : 'Phone: ') + a.contact_phone);

    if (opts.multiline) {
      return [line1, line2].filter(Boolean).concat(extra).join('\n');
    }
    var head = [line1, line2].filter(Boolean).join(' · ');
    return extra.length ? head + (head ? ' · ' : '') + extra.join(' · ') : head;
  }

  // ─── Export ────────────────────────────────────────────────────────────────
  window.ServiAddress = {
    OPTIONS: MEXICO_ADDRESS_OPTIONS,
    lang: lang,
    fieldsHTML: fieldsHTML,
    init: init,
    fill: fill,
    collect: collect,
    clear: clear,
    validate: validate,
    format: format,
    geolocate: geolocate,
    populateStates: populateStates,
    populateCities: populateCities,
    setGeo: setGeo,
  };
})();
