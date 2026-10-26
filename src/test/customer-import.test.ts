import { describe, it, expect } from 'vitest';
import { autoMap, buildImport, findExisting } from '@/lib/customerImport';

describe('customer import', () => {
  it('maps Gingr headers', () => {
    const m = autoMap(['Owner First Name', 'Owner Last Name', 'Owner Email', 'Animal Name', 'Breed Name'], 'gingr');
    expect(m['Owner Email']).toBe('email');
    expect(m['Animal Name']).toBe('pet_name');
    expect(m['Breed Name']).toBe('breed');
  });
  it('groups one-row-per-pet into one customer with multiple pets', () => {
    const map = autoMap(['First Name', 'Email', 'Pet Name']);
    const { customers } = buildImport([
      { 'First Name': 'Jane', Email: 'JANE@x.com', 'Pet Name': 'Biscuit' },
      { 'First Name': 'Jane', Email: 'jane@x.com', 'Pet Name': 'Mochi' },
    ], map);
    expect(customers).toHaveLength(1);
    expect(customers[0].pets.map(p => p.name)).toEqual(['Biscuit', 'Mochi']);
  });
  it('matches existing customers by phone digits', () => {
    const { customers } = buildImport([{ Phone: '(555) 123-4567', Name: 'Al' }], autoMap(['Phone', 'Name']));
    expect(findExisting(customers[0], [{ id: 'c1', email: '', phone: '+1 555-123-4567' }])?.id).toBe('c1');
  });
});
