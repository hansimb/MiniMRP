insert into products (id, name, image)
values
  ('11111111-1111-1111-1111-111111111111', 'SAI Spectrum Analyzer', null),
  ('22222222-2222-2222-2222-222222222222', 'SAI Audio Module', null)
on conflict (id) do nothing;

insert into product_versions (id, product_id, version_number)
values
  ('11111111-aaaa-1111-aaaa-111111111111', '11111111-1111-1111-1111-111111111111', 'v1'),
  ('11111111-bbbb-1111-bbbb-111111111111', '11111111-1111-1111-1111-111111111111', 'v2'),
  ('22222222-aaaa-2222-aaaa-222222222222', '22222222-2222-2222-2222-222222222222', 'v1')
on conflict (id) do nothing;

insert into components (id, name, category, producer, value)
values
  ('aaaaaaaa-1111-1111-1111-111111111111', 'Resistor 10k', 'Resistor', 'Yageo', '10k'),
  ('aaaaaaaa-2222-2222-2222-222222222222', 'Capacitor 100nF', 'Capacitor', 'Murata', '100nF'),
  ('aaaaaaaa-3333-3333-3333-333333333333', 'Audio Op Amp', 'IC', 'Texas Instruments', 'NE5532')
on conflict (id) do nothing;

insert into sellers (id, name, base_url, lead_time)
values
  ('bbbbbbbb-1111-1111-1111-111111111111', 'Mouser', 'https://www.mouser.com', 7),
  ('bbbbbbbb-2222-2222-2222-222222222222', 'DigiKey', 'https://www.digikey.com', 6)
on conflict (id) do nothing;

insert into component_sellers (component_id, seller_id, product_url)
values
  ('aaaaaaaa-1111-1111-1111-111111111111', 'bbbbbbbb-1111-1111-1111-111111111111', 'https://www.mouser.com'),
  ('aaaaaaaa-2222-2222-2222-222222222222', 'bbbbbbbb-2222-2222-2222-222222222222', 'https://www.digikey.com')
on conflict (component_id, seller_id) do nothing;

insert into inventory (id, component_id, quantity_available, purchase_price)
values
  ('cccccccc-1111-1111-1111-111111111111', 'aaaaaaaa-1111-1111-1111-111111111111', 1200, 0.01),
  ('cccccccc-2222-2222-2222-222222222222', 'aaaaaaaa-2222-2222-2222-222222222222', 800, 0.03),
  ('cccccccc-3333-3333-3333-333333333333', 'aaaaaaaa-3333-3333-3333-333333333333', 40, 1.8)
on conflict (id) do nothing;

insert into attachments (id, version_id, file_path)
values
  ('dddddddd-1111-1111-1111-111111111111', '11111111-aaaa-1111-aaaa-111111111111', '/files/spectrum-analyzer-v1-bom.xlsx'),
  ('dddddddd-2222-2222-2222-222222222222', '11111111-bbbb-1111-bbbb-111111111111', '/files/spectrum-analyzer-v2-sch.pdf')
on conflict (id) do nothing;

insert into component_references (version_id, component_master_id, reference)
values
  ('11111111-aaaa-1111-aaaa-111111111111', 'aaaaaaaa-1111-1111-1111-111111111111', 'R1'),
  ('11111111-aaaa-1111-aaaa-111111111111', 'aaaaaaaa-2222-2222-2222-222222222222', 'C1'),
  ('11111111-bbbb-1111-bbbb-111111111111', 'aaaaaaaa-3333-3333-3333-333333333333', 'U1')
on conflict (version_id, reference) do nothing;
