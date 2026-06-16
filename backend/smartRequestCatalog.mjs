// Server-side mirror of frontend/smart-request/catalog.js (category -> sub -> services).
// KEEP IN SYNC with the frontend catalog. The model's returned keys are re-validated
// against the client catalog in parse.js, so minor drift degrades gracefully.
export const SERVI_CATALOG = {
  cleaning: { label: 'Cleaning', subs: [
    { key: 'home-cleaning', label: 'Home cleaning', services: ['Weekly apartment cleaning', 'Kitchen and stove cleaning', 'Full bathroom cleaning', 'Dusting and vacuuming bedrooms and living room', 'Pre-guest home refresh'] },
    { key: 'deep-cleaning', label: 'Deep cleaning', services: ['Post-party deep cleaning', 'Oven and refrigerator interior cleaning', 'Bathroom grout and scale removal', 'Closet and pantry deep clean', 'Seasonal whole-home deep cleaning'] },
    { key: 'dry-cleaning', label: 'Dry cleaning', services: ['Dry cleaning for suits and blazers', 'Dress stain removal', 'Blanket and comforter cleaning', 'Curtain and linen cleaning', 'Weekday garment pickup and delivery'] },
  ] },
  repair: { label: 'Repair & Maintenance', subs: [
    { key: 'gardening', label: 'Gardening', services: ['Lawn mowing', 'General garden maintenance', 'Shrub and hedge trimming', 'Irrigation system check', 'Leaf removal and outdoor cleanup'] },
    { key: 'plumbing', label: 'Plumbing', services: ['Sink or drain unclogging', 'Toilet leak repair', 'Faucet or mixer replacement', 'Water heater diagnosis', 'Pipe leak repair', 'Low water pressure repair'] },
    { key: 'electrical', label: 'Electrical', services: ['Light fixture installation', 'Outlet and switch replacement', 'Short circuit or breaker troubleshooting', 'Ceiling fan installation', 'Interior wiring inspection'] },
    { key: 'carpentry', label: 'Carpentry', services: ['Custom shelf installation', 'Closet or cabinet door repair', 'Interior door alignment', 'Wood furniture repair', 'Baseboard and trim installation'] },
    { key: 'locksmith', label: 'Locksmith', services: ['Emergency home lockout', 'Car lockouts', 'Key duplication', 'Smart lock installation', 'Stuck lock adjustment'] },
    { key: 'handyman', label: 'Handyman', services: ['TV wall mounting', 'Small wall patching and repairs', 'Curtain rod or blind installation', 'Kitchen or bathroom caulking', 'Hanging mirrors, frames, or accessories'] },
    { key: 'assembly-installation', label: 'Assembly & installation', services: ['Bed frame assembly', 'Desk or bookcase assembly', 'Modular shelving installation', 'Washer or dryer hookup', 'Flat-pack furniture installation'] },
    { key: 'tailoring', label: 'Tailoring', services: ['Pant hemming', 'Dress or skirt alterations', 'Zipper replacement', 'Blazer or suit tailoring', 'Curtain or tablecloth alterations'] },
  ] },
  moving: { label: 'Move & Transport', subs: [
    { key: 'moving', label: 'Moving', services: ['In-city apartment move', 'Packing help for moving boxes', 'Truck loading and unloading', 'Move-in setup assistance'] },
    { key: 'large-items', label: 'Large items', services: ['Sofa transport', 'Mattress and bed base moving', 'Refrigerator or washer relocation', 'Large dining table delivery'] },
    { key: 'errands', label: 'Errands', services: ['Urgent grocery run', 'Pharmacy pickup', 'Document or key drop-off', 'Store returns and exchanges'] },
    { key: 'deliveries', label: 'Deliveries', services: ['Same-day express delivery', 'Large store purchase delivery', 'Catering tray delivery', 'Flower or gift delivery', 'Scheduled recurring delivery route'] },
  ] },
  wellness: { label: 'Wellness & Personal Care', subs: [
    { key: 'massage', label: 'Massage', services: ['In-home relaxation massage', 'Deep-tension back massage', 'Couples massage session', 'Muscle recovery massage', 'Post-travel or stress relief massage'] },
    { key: 'therapist', label: 'Therapist', services: ['Online individual therapy session', 'Stress and anxiety counseling', 'Couples therapy', 'Grief or life-transition support', 'Introductory teen counseling session'] },
    { key: 'personal-trainer', label: 'Personal trainer', services: ['At-home strength workout', 'Weight-loss plan kickoff', 'Mobility and stretching session', 'Beginner fitness training', 'Low-impact conditioning workout'] },
    { key: 'pet-care', label: 'Pet care', services: ['Daily dog walking', 'Pet sitting during travel', 'Basic bath and brushing', 'Feeding and water refill visit', 'Medication support visit'] },
    { key: 'child-care', label: 'Child care', services: ['After-school babysitting', 'Evening babysitter for date night', 'School pickup and in-home care', 'Weekend nanny support', 'Hourly infant care'] },
    { key: 'elder-assistance', label: 'Elder assistance', services: ['Companion visit at home', 'Medication reminder support', 'Medical appointment accompaniment', 'Light meal-prep assistance', 'Walking and basic mobility support'] },
  ] },
  suppliers: { label: 'Suppliers', subs: [
    { key: 'artisan-bread', label: 'Artisan bread', services: ['Sourdough bread order', 'Brioche and pastry box', 'Brunch or breakfast bakery order', 'Dinner rolls and buns order', 'Weekly bread subscription'] },
    { key: 'fresh-dairy', label: 'Fresh dairy', services: ['Milk and yogurt restock', 'Artisan cheese board order', 'Butter and cream delivery', 'Lactose-free dairy delivery', 'Breakfast dairy bundle'] },
    { key: 'pharmacy', label: 'Pharmacy', services: ['Same-day prescription pickup', 'Over-the-counter medication order', 'First-aid kit refill', 'Baby care essentials order'] },
    { key: 'catering', label: 'Catering', services: ['Office lunch trays', 'Brunch catering setup', 'Cocktail bites for events', 'Family buffet catering', 'Boxed lunches for small teams'] },
    { key: 'organic-butcher', label: 'Organic butcher', services: ['Steak and grill order', 'Weekly chicken pack', 'Ground meat for burgers', 'Specialty cuts by request', 'Soup bones and broth staples'] },
    { key: 'fish', label: 'Fish', services: ['Salmon fillet delivery', 'Fresh shrimp order', 'Sushi-grade tuna order', 'Family seafood pack', 'Whole fish cleaned and ready to cook'] },
    { key: 'organic-vegetables', label: 'Organic vegetables', services: ['Weekly organic produce box', 'Leafy greens and salad restock', 'Seasonal cooking vegetables', 'Juicing and smoothie bundle', 'Family fruit and vegetable basket'] },
  ] },
};

export function catalogPromptText() {
  return Object.keys(SERVI_CATALOG).map((k) => {
    const c = SERVI_CATALOG[k];
    const subs = c.subs.map((s) => `    - ${s.key} ("${s.label}"): ${s.services.join(' / ')}`).join('\n');
    return `${k} ("${c.label}"):\n${subs}`;
  }).join('\n');
}

export const CATEGORY_KEYS = Object.keys(SERVI_CATALOG);
